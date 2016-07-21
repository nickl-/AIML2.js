var TrieNode = require('./TrieNode');
var Path = require('./Path');
var AIMLProcessor = require('./AIMLProcessor');
var Bot = require('./Bot');
var Session = require('./ChatSession');

var bot = new Bot('alice2', './');
var session = new Session();

// bot.setMap = new Map();
tmpSet = ["FISH", "MATTER", "SLEEP", "LOVE"];
tmpSet.maxLength = 1;
bot.sets.set("be", tmpSet);

bot.loadAIMLFiles();

function askAlice(req) {
  console.log(">>" + req);
  return bot.respond(req, session).then(function (result) {
    console.log(result);
  }).catch(function(error) {console.log("Error: " + err); console.log(err.stack)})
}
var response = askAlice("You are lazy.");

response = response.then(function(result) {return askAlice("Why will not you bonk and jive?")});

response = response.then(function(result) {return askAlice("What is cheez whiz made from?")});

response = response.then(function(result) {return askAlice("Would you rather fish for salmon or sleep in?")});

response = response.then(function(result) {return askAlice("Alice 2.0, Name something you find at a beach")});

response = response.then(function(result) {return askAlice("what is the capital of arkansas?")});

response = response.then(function(result) {return askAlice("what is the capital of Canada?")});

response = response.then(function(result) {return askAlice("How old are you?")});

response = response.then(function(result) {return askAlice("How much is that doggy in the window?")});

response = response.then(function(result) {return askAlice("well, aren't you clever?")});

response = response.then(function(result) {return askAlice("My favourite eggplant is spongebob squarepants")});

response = response.then(function(result) { return askAlice("What is my favourite eggplant?")});

response = response.then(function(result) { return askAlice("pick a number between 1 and 10")});

const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

rl.on('line', (line) => {
  bot.respond(line, session).then(function(result) {console.log(result)});
});

rl.on('close', () => {
  console.log("Goodbye!");
})
