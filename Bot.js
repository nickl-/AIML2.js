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
}

Bot.prototype.loadAIMLFiles = function () {
  this.isAIMLFileLoadingStarted = true;

  var categories = AIMLProcessor.AIMLToCategories('./personality.aiml');
  console.log("Loaded ", categories.length, " categories.");
  for (var c of categories)
  {
    p = Path.sentenceToPath(c.pattern + " <THAT> " + c.that + " <TOPIC> " + c.topic);
    this.root.addPath(p, c);
  }

  this.isAIMLFileLoadingFinished = true;
}

Bot.prototype.respond = function (input) {
  var response = '', matchedNode;

  for (sentence of input.split(/[\.\?!]/))
  {
    sentence = sentence.trim();
    if (sentence.length > 0)
    {
      matchedNode = this.root.match(this.preProcessor.normalize(sentence.trim()).toUpperCase(), "*", "*");
      if (matchedNode) { response = response + matchedNode.category.template }
      else { response = response + " ERROR " }
    }
  }
  return matchedNode;
}

module.exports = Bot;
