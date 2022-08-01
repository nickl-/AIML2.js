DomJS = require("dom-js").DomJS;
fs = require('fs');
readline = require("readline");
xmldom = require("xmldom")
DOMPrinter = new xmldom.XMLSerializer();
Promise = require("bluebird");

TrieNode = require('./TrieNode');
Path = require('./Path');
EventEmitter = require('eventemitter').EventEmitter;
var AIMLProcessor = require('./AIMLProcessor');
var PreProcessor = require('./PreProcessor');

function Bot(name, path) {
  this.name = name;
  this.setAllPaths(path, name);
  this.preProcessor = new PreProcessor(this);
  this.addProperties();
  this.addSets();
  this.addMaps();
  this.root = new TrieNode(this);
  this.ee = new EventEmitter();
  this.size = 0;
  this.vocabulary = new Set();
  // console.log("this.root = "+this.root);
}

Bot.prototype.setAllPaths = function (root, name) {
  var paths = {};
  paths.bots    = root+"/bots";
  paths.bot     = paths.bots+"/"+name;
  paths.aiml    = paths.bot+"/aiml";
  paths.aimlif  = paths.bot+"/aimlif";
  paths.config  = paths.bot+"/config";
  paths.log     = paths.bot+"/logs";
  paths.sets    = paths.bot+"/sets";
  paths.maps    = paths.bot+"/maps";
  this.paths = paths;
}

Bot.prototype.addProperties = function()
{
  this.properties = new Map();

  var rl = readline.createInterface({
    input: fs.createReadStream(this.paths.config +"/properties.txt")
  });

  var count = 0;
  rl.on('line', (line) => {
    line = line.trim();
    if (line.indexOf(":") > -1)
    {
      var pair = line.trim().split(/:/)
      this.properties.set(pair[0].trim(), pair[1].trim());
        count++;
    }
  });

  rl.on('close', () => {
    // console.log("Added " + count + " properties.");
  });
  return count; // this doesn't actually work because of callbacks and events and stuff. I think a Promise might be a way to fix it but I don't really understand promises yet.
}

Bot.prototype.addSets = function()
{
  this.sets = new Map();

  var path = this.paths.sets, sets = this.sets,
    preproc = this.preProcessor;
  var count = 0;

  fs.readdir(path, (err, files) => {
    if (err) { console.log("Error adding set files: "+err) }

    // the AIML 2.0 specification includes a number set which is all natural numbers
    sets.set('number', {
      maxLength: 1,
      has: function (str) {
        str = str.trim();
        var i = parseInt(str);

        // this just checks if a person typed in a 0, 1, 2, 3, etc.
        // If you want anything fancier, like hex or scientific or engineering
        // you'll have to do it as a precprocessor replacement or a pattern of its own
        if (i.toString() == str && i > -1) { return true; }
        else {return false;}
      }
    });
    count = count +1;

    for (var i = 0; i < files.length; i++)
    {
      var match = files[i].match(/^.*?([^\/\s]+)\.txt$/);// nogreedy first wildcard, default greedy second one
      if (match)
      {
        var setlist = fs.readFileSync(path+"/"+files[i], {encoding: 'utf-8'});
        setlist = setlist.trim().split(/[\r\n]+/);
        var maxlength = 0;
        for (var j = 0; j < setlist.length; j++)
        {
          setlist[j] = preproc.normalize(setlist[j]).trim().toUpperCase();
          let words = setlist[j].split(/\s+/);
          maxlength = Math.max(maxlength, words.length)
          words.forEach((word)=>{this.vocabulary.add(word.toLowerCase())});
        }
        // if (Math.random() < 0.05)
          // console.log("Adding set: "+match[1]+" = " + setlist);
        setlist = new Set(setlist);
        setlist.maxLength = maxlength;
        sets.set(match[1], setlist);
        count = count + 1;
      } else {
        console.log("Adding sets: failed to match ", files[i])
      }
    }
    // console.log("Added "+count+" sets.");
    return count; // this doesn't actually work because of callbacks and events and stuff. I think a Promise might be a way to fix it but I don't really understand promises yet.
  });

}

Bot.prototype.addMaps = function()
{
  this.maps = new Map();

  var path = this.paths.maps;
  var count = 0;

  fs.readdir(path, (err, files) => {
    if (err) { console.log("Error adding map files: "+err) }

    var maps = this.maps,
      preproc = this.preProcessor,
      count = 0;
    // the AIML 2.0 specification has 4 predefined maps:
    // successor -> x+1
    // predecssor -> x-1
    // singular -> map plural to singular nouns in english
    // plural -> map singular to plural nounds in english
    maps.set('successor', {
      get: function(str) {
        return (parseInt(str.trim()) + 1).toString();
      },
    })

    maps.set('predecessor', {
      get: function(str) {
        return (parseInt(str.trim()) - 1).toString();
      },
    })

    for (var i = 0; i < files.length; i++)
    {
      var match = files[i].match(/^.*?([^\/\s]+)\.txt$/);// nogreedy first wildcard, default greedy second one
      if (match)
      {
        var maplist = fs.readFileSync(path+"/"+files[i], {encoding: 'utf-8'});
        maplist = maplist.trim().split(/[\r\n]+/);
        var mapmap = new Map();
        for (var j = 0; j < maplist.length; j++)
        {
          var pair = maplist[j].split(/:/);
          if (pair[0])
          {
            mapmap.set(pair[0].trim().toUpperCase(), pair[1])
          }
        }
        // console.log("Adding map: "+match[1]+" = " + mapmap);
        // if (Math.random() < 0.05)
          // mapmap.forEach(function(val, key, map) { console.log("maps["+match[1]+"]["+key+"] = "+val)});
        maps.set(match[1], mapmap);
        count = count + 1;
      } else {
        console.log("Adding maps: failed to match ", files[i])
      }
    }
    // console.log("Added "+count+" maps.");
    return count; // this doesn't actually work because of callbacks and events and stuff. I think a Promise might be a way to fix it but I don't really understand promises yet.
  });

}


Bot.prototype.replaceBotProperties = function(pattern)
{
  var offset = 0, match,
    properties = this.properties, preproc = this.preProcessor;
  do
  {
    prevPattern = pattern;
    pattern = pattern.replace(/<bot name="(.*?)"\/>/i, function (str, p1, offset, s) { return preproc.normalize(properties.get(p1)).toUpperCase().trim() });
    // if (prevPattern != pattern) { console.log("  relaceBotProperties: " + prevPattern + " -> " +pattern) }
  } while (prevPattern != pattern);
  return pattern;
}

Bot.prototype.addCategory = function (c)
{
  var p = Path.sentenceToPath(this.replaceBotProperties(c.pattern + " <THAT> " + c.that + " <TOPIC> " + c.topic));
  this.root.addPath(p, c);
  this.size = this.size+1;
  c.pattern.replace(/[\*\#\_\^\$]/g, '').split(/\s+/).forEach((word)=>{this.vocabulary.add(word.toLowerCase())});
}

Bot.prototype.loadAIMLFiles = function () {
  this.isAIMLFileLoadingStarted = true;

  // var default_aiml_dir = "./bots/alice2/aiml";
  var default_aiml_dir = this.paths.aiml;

  fs.readdir(default_aiml_dir, (function (err,files) {

    function processCategories(categories) {
      // console.log("Loaded ", categories.length, " categories.");
      for (var c of categories)
      {
        this.addCategory(c);
      }
      return loadAIMLFile.call(this, files.shift());
    }

    function loadAIMLFile(filename) {
      if (filename)
      {
        AIMLProcessor.AIMLToCategories(default_aiml_dir + "/" + filename, processCategories.bind(this));

      }
      else
      {
        this.isAIMLFileLoadingFinished = true;
        this.ee.emit('AIML FILES LOADED');
      }
    }

    loadAIMLFile.call(this, files.shift());

  }).bind(this));

}

// to promisify this and deal with the possible delay in loading of AIML
// we need a wrapper function
Bot.prototype.respond = function (input, session, callback) {
  return new Promise(((input, session, callback) => {return (fullfill, reject) => {
    if (this.isAIMLFileLoadingFinished) {
        var temp = this.$respond(input, session, callback);
      fullfill(temp);
    } else {
      this.ee.on("AIML FILES LOADED", ()=>{
        var temp = this.$respond(input, session, callback);
        fullfill(temp);
      })
    }
  }})(input, session, callback))
}

Bot.prototype.$respond = function (input, session, callback) {
    var response = '', matchedNode, responseHolder;
    // console.log("Responding to reqest from session "+session.id);

    input = this.preProcessor.normalize(input);
    input = input.replace("。",".");
    input = input.replace("？","?");
    input = input.replace("！","!");

    session.requestHistory.unshift(input); // there's some irony in the variable name choices here.
    var thatContext = [];
    for (sentence of input.split(/[\.\?!]/))
    {
      sentence = sentence.trim();
      if (sentence.length > 0)
      {
        // console.log("Searching for sentence " + sentence);
        var that  = (session.thatHistory[0] || ['*'])[0];
        var topic = session.predicates.get("topic") || "*";
        session.inputHistory.unshift(sentence.trim())
        matchedNode = this.root.match(sentence.trim(), that, topic);
        if (matchedNode)
        {
          if (Array.isArray(matchedNode.category))
          {
            var categories = matchedNode.category;
          }
          else
          {
            var categories = [matchedNode.category];
          }
          // console.log(DOMPrinter.serializeToString(matchedNode.category.pattern)+matchedNode.category.file);
          for (category of categories)
          {
            // console.log("Found category: " + DOMPrinter.serializeToString(category.pattern)+category.file);
            // console.log("category.session_id = " + category.session_id);
            if (!category.session_id || category.session_id == session.id)
            {
              var ap = new AIMLProcessor(category.template, matchedNode.inputStars, matchedNode.thatStars, matchedNode.topicStars, session, this);
              var addToContext = (nextResponse) => {
                for(var responseSentence of this.preProcessor.normalize(nextResponse).split(/[\.\?!]/))
                {
                  responseSentence = responseSentence.trim();
                  if (responseSentence.length > 0)
                  {
                    // console.log("Adding " + responseSentence + " to context hisory.");
                    thatContext.unshift(responseSentence);
                  }
                }
              }
              if (!responseHolder) {
                responseHolder = ap.evalTemplate().then(function (res){
                  addToContext(res);
                  return res;
                });
              }
              else
              {
                responseHolder = responseHolder.then( (function resultChainer(tempProcessor) {
                  return function(response) {
                    return tempProcessor.evalTemplate().then(function (nextResponse){
                      addToContext(nextResponse);
                      return response + ' ' + nextResponse;
                    })
                  }
                })(ap))
              }
              // var currentResponse = ap.evalTemplate();
              // response = response + " "
              // + currentResponse;
            }
          }
        }
        else
        {
          //response = response + " ERROR "
          if (!responseHolder) {
            responseHolder = new Promise(function(fullfill, reject) {
              fullfill("ERROR");
            })
          }
          else {
            responseHolder = responseHolder.then(
              function (res) {
                return res + " ERROR";
              }
            )
          }
        }
      }
    }
    responseHolder = responseHolder.then( ((callback, session, thatContext) => {
      return (response) => {
      response = response.trim();
      if (response.length > 0)
      {
        // console.log("Adding "+response+" to response history");
        session.responseHistory.unshift(response);
      }
      if (thatContext.length > 0)
      {
        // console.log("Adding "+thatContext+" to that history");
        session.thatHistory.unshift(thatContext);
      }
      if (callback) {callback(response)}
      return response;
    }})(callback, session, thatContext))
    .catch((err)=> {
      console.log("Promise chain failed: " + err + "\n" + err.stack);
    });
    return responseHolder;
}

module.exports = Bot;
