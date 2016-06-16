DomJS = require("dom-js").DomJS;
fs = require('fs');
readline = require("readline");
xmldom = require("xmldom")
DOMPrinter = new xmldom.XMLSerializer();

TrieNode = require('./TrieNode');
Path = require('./Path');
EventEmitter = require('eventemitter').EventEmitter;
var AIMLProcessor = require('./AIMLProcessor');
var PreProcessor = require('./PreProcessor');

var ee = new EventEmitter();

function Bot(name, path) {
  this.name = name;
  this.setAllPaths(path, name);
  this.addProperties();
  this.preProcessor = new PreProcessor(this);
  this.root = new TrieNode(this);
  this.setMap = new Map();
  this.mapMap = new Map();
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
    console.log("Added " + count + " properties.");
  });
  return count; // this doesn't actually work because of callbacks and events and stuff. I think a Promise might be a way to fix it but I don't really understand promises yet.
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

Bot.prototype.loadAIMLFiles = function () {
  this.isAIMLFileLoadingStarted = true;

  var default_aiml_dir = "./bots/alice2/aiml";

  fs.readdir(default_aiml_dir, (function (err,files) {

    function processCategories(categories) {
      console.log("Loaded ", categories.length, " categories.");
      for (var c of categories)
      {
        p = Path.sentenceToPath(this.replaceBotProperties(c.pattern + " <THAT> " + c.that + " <TOPIC> " + c.topic));
        this.root.addPath(p, c);
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
      }
    }

    loadAIMLFile.call(this, files.shift());

  }).bind(this));

}

Bot.prototype.respond = function (input, callback) {
  if (this.isAIMLFileLoadingFinished)
  {
    var response = '', matchedNode;

    input = this.preProcessor.normalize(input);
    input = input.replace("。",".");
    input = input.replace("？","?");
    input = input.replace("！","!");

    for (sentence of input.split(/[\.\?!]/))
    {
      sentence = sentence.trim();
      if (sentence.length > 0)
      {
        // console.log("Searching for sentence " + sentence);
        matchedNode = this.root.match(this.preProcessor.normalize(sentence.trim()), "*", "*");
        if (matchedNode)
        {
          // console.log(DOMPrinter.serializeToString(matchedNode.category.pattern)+matchedNode.category.file);
          var ap = new AIMLProcessor(matchedNode.category.template, matchedNode.inputStars, matchedNode.thatStars, matchedNode.topicStars, new Array(), this);
          response = response
            + ap.evalTemplate();
        }
        else
        {
          response = response + " ERROR "
        }
      }
    }
    callback(response);
  }
  else
  {
    console.log("Bot not ready yet... trying again in 1 second.");
    setTimeout((function() { this.respond(input, callback) }).bind(this), 1000);
  }
}

module.exports = Bot;
