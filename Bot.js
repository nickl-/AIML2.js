DomJS = require("dom-js").DomJS;
fs = require('fs');

TrieNode = require('./TrieNode');
Path = require('./Path');
EventEmitter = require('eventemitter').EventEmitter;
var AIMLProcessor = require('./AIMLProcessor');
var PreProcessor = require('./PreProcessor');

var ee = new EventEmitter();

var storedVariableValues = {};
var botAttributes = {};

var lastWildCardValue = '';
var wildCardArray = [];

var domArray = [];
var fileArray = [];
var domIndex = 0;

var isAIMLFileLoadingStarted = false;
var isAIMLFileLoaded = false;

var previousAnswer = '';
var previousThinkTag = false;

var root = new TrieNode();

function Bot(botAttributes) {
  this.botAttributes = botAttributes;
  this.preProcessor = new PreProcessor(this);
  this.root = new TrieNode(this);
  console.log("this.root = "+this.root);
}

Bot.prototype.loadAIMLFiles = function () {
  this.isAIMLFileLoadingStarted = true;

  var default_aiml_dir = "./bots/alice2/aiml";

  fs.readdir(default_aiml_dir, (function (err,files) {

    function processCategories(categories) {
      console.log("Loaded ", categories.length, " categories.");
      for (var c of categories)
      {
        p = Path.sentenceToPath(c.pattern + " <THAT> " + c.that + " <TOPIC> " + c.topic);
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

    for (sentence of input.split(/[\.\?!]/))
    {
      sentence = sentence.trim();
      if (sentence.length > 0)
      {
        matchedNode = this.root.match(this.preProcessor.normalize(sentence.trim()).toUpperCase(), "*", "*");
        if (matchedNode)
        {
          response = response
          + AIMLProcessor.evalTemplate(matchedNode.category.template, matchedNode.inputStars);
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
