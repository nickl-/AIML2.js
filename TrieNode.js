var AIMLProcessor = require('./AIMLProcessor');

function TrieNode(bot) {
  this.bot = bot;
  this.key = '';
  this.value = undefined;
  this.height = Number.MAX_SAFE_INTEGER;
  this.map = undefined;

  this.category = undefined;
  this.starBindings = undefined;
  this.sets = undefined;
  this.shortcut = false;
}

TrieNode.prototype.size = function() {
  var s = this.map.size();
  if (key && key != "")
  {
    s = s + 1;
  }
  return s;
}

TrieNode.prototype.contains = function (word) {
  if (this.map)
  {
    return this.map.has(word);
  }
  return (word == this.key);
}


TrieNode.prototype.get = function (key) {
  if (this.map)
  {
    return this.map.get(key);
  }
  else
  {
    if (this.key == key)
    {
      return this.value;
    }
  }
  return undefined;
}

TrieNode.prototype.put = function (key, value) {
  if (this.map)
  {
    this.map.set(key, value);
  }
  else
  {
    this.key = key;
    this.value = value;
  }
}

TrieNode.prototype.printKeys = function () {
  if (this.map)
  {
    this.map.keys().forEach(function(k) { console.log(k) });
  }
}

TrieNode.prototype.upgrade = function () {
  this.map = new Map();
  this.map.set(this.key, this.value);
  this.key = '';
  this.value = undefined;
}

TrieNode.prototype.addSets = function (word, fileName) {
  // console.log("Adding set "  + word);
  var setName = AIMLProcessor.trimTag(word, "set");
  // console.log("this.bot.sets.has(" + setName + ") : " + this.bot.sets.has(setName));
  if (this.bot.sets.has(setName)) {
    if (!this.sets) { this.sets = new Array(); }
    this.sets.push(setName)
  }
}

TrieNode.prototype.addPath = function(path, category) {
  if (!path)
  {
    // Merge policy: save all categories. This will also help with
    // dealin with the <learn> tag which isn't supposed to go across
    // sessions.
    if (Array.isArray(this.category))
      this.category.push(category);
    else if (this.category)
      this.category = [this.category, category];
    else
      this.category = category;
    this.height = 0;
  }
  else if (this.contains(path.word))
  {
    if (path.word.startsWith("<set>")) { this.addSets(path.word, this.bot, category.filename) }
    var next = this.get(path.word);
    next.addPath(path.next, category);
    var offset = 1;
    if (path.word == '#' || path.word == '^')
    {
      offset = 0
    }
    this.height = Math.min(next.height + offset, this.height);
  }
  else
  {
      if (path.word.startsWith("<set>")) { this.addSets(path.word, this.bot, category.filename) }
      var next = new TrieNode(this.bot);
      if (this.key)
      {
        this.upgrade();
      }
      this.put(path.word, next);
      next.addPath(path.next, category);
      var offset = 1;
      if (path.word == '#' || path.word == '^')
      {
        offset = 0;
      }
      this.height = Math.min(next.height + offset, this.height);
  }
}

TrieNode.prototype.findNode = function(path) {
  if (!path)
  {
    return this;
  }
  else if (this.contains(path.word))
  {
    var next = this.get(path.word)
    return next.findNode(path.next);
  }
  else
  {
    return undefined;
  }
}

TrieNode.prototype.isLeaf = function () {
  return this.category != undefined;
}

function makeInputThatTopic(input, that, topic) {
  // console.log("Input = " + input + ",  That = " + that + ",  Topic = " + topic);
  return input.trim() + " <THAT> " + that.trim() + " <TOPIC> " + topic.trim();
}

TrieNode.prototype.match = function (input, that, topic) {
  // console.log("Got input, that, topic = ", input, that, topic);
  var inputThatTopic = makeInputThatTopic(input, that, topic);
  // console.log("Searching for sentence to match ", inputThatTopic);
  var p = Path.sentenceToPath(inputThatTopic);
  var starState = "inputStars";
  var inputStars = new Array(),
    topicStars = new Array(),
    thatStars = new Array();
  var n = this.$match(p, inputThatTopic, starState, 0, inputStars, thatStars, topicStars, "");
  // console.log("input * = ", inputStars );
  // console.log("that * = ", thatStars );
  // console.log("topic * = ", topicStars );

  return {category: n.category, inputStars: inputStars, thatStars: thatStars, topicStars: topicStars};
}

TrieNode.prototype.$match = function (path, inputThatTopic, starState, starIndex, inputStars, thatStars, topicStars, matchTrace) {
  // console.log(matchTrace + "$match(" + (path ? path.word : " end of path ") + ")");
  var matchedNode = this.nullMatch(path, matchTrace);
  if (matchedNode) { return matchedNode }
  else if (path.length < this.height) { return null; }

  // console.log("Checking for dollarMatch at "+path.word);
  matchedNode = this.dollarMatch(path, inputThatTopic, starState, starIndex, inputStars, thatStars, topicStars, matchTrace);
  if (matchedNode) { return matchedNode }
  // console.log("Checking for sharpMatch at "+path.word);
  matchedNode = this.sharpMatch(path, inputThatTopic, starState, starIndex, inputStars, thatStars, topicStars, matchTrace);
  if (matchedNode) { return matchedNode }
  // console.log("Checking for underscoreMatch at "+path.word);
  matchedNode = this.underscoreMatch(path, inputThatTopic, starState, starIndex, inputStars, thatStars, topicStars, matchTrace);
  if (matchedNode) { return matchedNode }
  // console.log("Checking for wordMatch at "+path.word);
  matchedNode = this.wordMatch(path, inputThatTopic, starState, starIndex, inputStars, thatStars, topicStars, matchTrace);
  if (matchedNode) { return matchedNode }
  // console.log("Checking for setMatch at "+path.word);
  matchedNode = this.setMatch(path, inputThatTopic, starState, starIndex, inputStars, thatStars, topicStars, matchTrace);
  if (matchedNode) { return matchedNode }
  // console.log("Checking for caretMatch at "+path.word);
  matchedNode = this.caretMatch(path, inputThatTopic, starState, starIndex, inputStars, thatStars, topicStars, matchTrace);
  if (matchedNode) { return matchedNode }
  // console.log("Checking for starMatch at "+path.word);
  matchedNode = this.starMatch(path, inputThatTopic, starState, starIndex, inputStars, thatStars, topicStars, matchTrace);
  if (matchedNode) { return matchedNode }
  return null;

}

var setStars = function(starWords, starIndex, starState, inputStars, thatStars, topicStars)
{
  if (starIndex < 10)
  {
    starWords = starWords.trim();
    if (starState == 'inputStars') { inputStars[starIndex] = starWords }
    else if (starState == "thatStars") { thatStars[starIndex] = starWords }
    else if (starState === "topicStars") { topicStars[starIndex] = starWords }
  }

}

function failMatch(location, trace) {
  var printTrace = false; // debug print
  if (printTrace)
  {
    console.log("Failed at " + location + ": " + trace);
  }
}

TrieNode.prototype.nullMatch = function (path, matchTrace) {
  // console.log(matchTrace + "nullMatch(" + (path? path.word : " end of path ") + ")");
  if (!path && this.isLeaf())
  {
    return this;
  }
  failMatch("nullMatch ", matchTrace);
}

TrieNode.prototype.wordMatch = function (path, inputThatTopic, starState, starIndex, inputStars, thatStars, topicStars, matchTrace) {
  // console.log(matchTrace + "wordMatch(" + path.word + ")");
  var uword = path.word.toUpperCase();
  matchTrace = matchTrace + "["+uword+","+uword+"]";
  if (uword == "<THAT>") { starIndex = 0; starState = "thatStars"}
  else if (uword == "<TOPIC>") {starIndex = 0; starState = "topicStars"}
  if (path && this.contains(uword))
  {
    var matchedNode = this.get(uword).$match(path.next, inputThatTopic, starState, starIndex, inputStars, thatStars, topicStars, matchTrace);
    if (matchedNode) { return matchedNode }
  } else {
    failMatch("wordMatch", matchTrace);
    return null;
  }
}

TrieNode.prototype.dollarMatch = function (path, inputThatTopic, starState, starIndex, inputStars, thatStars, topicStars, matchTrace) {
  // console.log(matchTrace + "dollarMatch(" + path.word + ")");
  var uword = "$" + path.word.toUpperCase();
  matchTrace = matchTrace + "[" + uword + "," + uword + "]";
  if (path && this.contains(uword))
  {
    var matchedNode = this.get(uword).$match(path.next, inputThatTopic, starState, starIndex, inputStars, thatStars, topicStars, matchTrace);
    if (matchedNode) { return matchedNode }
  } else {
    failMatch("dollarMatch", matchTrace);
    return null;
  }
}

TrieNode.prototype.starMatch = function (path, input, starState, starIndex, inputStars, thatStars, topicStars, matchTrace) {
  return this.wildMatch(path, input, starState, starIndex, inputStars, thatStars, topicStars, "*", matchTrace);
}

TrieNode.prototype.underscoreMatch = function (path, input, starState, starIndex, inputStars, thatStars, topicStars, matchTrace) {
  return this.wildMatch(path, input, starState, starIndex, inputStars, thatStars, topicStars, "_", matchTrace);
}

TrieNode.prototype.caretMatch = function (path, input, starState, starIndex, inputStars, thatStars, topicStars, matchTrace) {
  var matchedNode = this.zeroMatch(path, input, starState, starIndex, inputStars, thatStars, topicStars, "^", matchTrace);
  if (matchedNode) { return matchedNode; }
  return this.wildMatch(path, input, starState, starIndex, inputStars, thatStars, topicStars, "^", matchTrace);
}

TrieNode.prototype.sharpMatch = function (path, input, starState, starIndex, inputStars, thatStars, topicStars, matchTrace) {
  var matchedNode = this.zeroMatch(path, input, starState, starIndex, inputStars, thatStars, topicStars, "#", matchTrace);
  if (matchedNode) { return matchedNode; }
  return this.wildMatch(path, input, starState, starIndex, inputStars, thatStars, topicStars, "#", matchTrace);
}

TrieNode.prototype.zeroMatch = function (path, input, starState, starIndex, inputStars, thatStars, topicStars, wildCard, matchTrace) {
  // console.log(matchTrace + "zeroMatch" + wildCard + "(" + path.word + ")");
  matchTrace = matchTrace + "[" + wildCard + ",]";
  if (path && this.contains(wildCard))
  {
    setStars("nullstar", starIndex, starState, inputStars, thatStars, topicStars);
    var nextNode = this.get(wildCard);
    return nextNode.$match(path, input, starState, starIndex+1, inputStars, thatStars, topicStars, matchTrace);
  }
  else
  {
    failMatch("zeroMatch", matchTrace)
    return null;
  }
}

TrieNode.prototype.wildMatch = function (path, input, starState, starIndex, inputStars, thatStars, topicStars, wildCard, matchTrace) {
  // console.log(matchTrace + "wildMatch" + wildCard + "(" + path.word + ")");
  if (path.word == "<THAT>" || path.word == "<TOPIC>")
  {
    failMatch("wildMatch1"+wildCard,matchTrace);
    return null;
  }

  if (path && this.contains(wildCard))
  {
    matchTrace = matchTrace + "[" + wildCard + "," + path.word + "]";
    var currentWord = path.word;
    var starWords = currentWord + " ";
    var pathStart = path.next;
    var nextNode = this.get(wildCard);
    var matchedNode;
    if (nextNode.isLeaf())
    {
      matchedNode = nextNode;
      starWords = path.toSentence();
      setStars(starWords, starIndex, starState, inputStars, thatStars, topicStars);
      return matchedNode;
    }
    else
    {
      for (var qath = pathStart; qath && (currentWord != "<THAT>") && (currentWord != "<TOPIC>"); qath = qath.next)
      {
        matchTrace = matchTrace + "[" + wildCard + "," + qath.word + "]";
        matchedNode = nextNode.$match(qath, input, starState, starIndex + 1, inputStars, thatStars, topicStars, matchTrace);
        if (matchedNode)
        {
          setStars(starWords, starIndex, starState, inputStars, thatStars, topicStars);
          return matchedNode;
        }
        else
        {
          currentWord = qath.word;
          starWords += currentWord + " ";
        }
      }
      failMatch("wildMatch2"+wildCard, matchTrace);
      return null;
    }
  }
}

TrieNode.prototype.setMatch = function (path, input, starState, starIndex, inputStars, thatStars, topicStars, matchTrace)
{
  // console.log(matchTrace + "setMatch(" + path.word + ")");
  if (!this.sets || path.word == "<THAT>" || path.word == "<TOPIC>") { return null; }
  for( var setName of this.sets )
  {
    var nextNode = this.get("<set>"+setName+"</set>");
    aimlSet = this.bot.sets.get(setName);
    var matchedNode, bestMatchedNode = null;
    var currentWord = path.word;
    var starWords = currentWord + " ";
    var length = 1;
    for (var qath = path.next; qath && currentWord != "<THAT>" && currentWord != "<TOPIC>" && length <= aimlSet.maxLength; qath = qath.next) {
      var phrase = this.bot.preProcessor.normalize(starWords).trim().toUpperCase();
      // console.log("Searching for phrase \"" + phrase + "\"");
      if (aimlSet.indexOf(phrase) > -1)
      {
        matchTrace = matchTrace + "[<set>"+setName+"</set>,"+phrase+"]";
        // console.log("Found it")
        matchedNode = nextNode.$match(qath, input, starState, starIndex+1, inputStars, thatStars, topicStars, matchTrace);
        if (matchedNode)
        {
          setStars(starWords, starIndex, starState, inputStars, thatStars, topicStars);
          bestMatchedNode = matchedNode;
        }
      }
      length = length + 1;
      currentWord = qath.word;
      starWords = starWords + currentWord + " ";
    }
    if (bestMatchedNode) { return bestMatchedNode }
  }
  failMatch("setMatch", matchTrace);
  return null;
}

module.exports = TrieNode;
