DomJS = require("dom-js").DomJS;
fs = require('fs');

TrieNode = require('./TrieNode');
Path = require('./Path');
EventEmitter = require('eventemitter').EventEmitter;

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
}

Bot.prototype.loadAIMLFiles = function (inFiles) {
  this.isAIMLFileLoadingStarted = true;

}

module.exports = Bot;
