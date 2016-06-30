function ChatSession() {
  this.id = 'random';
  this.predicates = new Map();
  this.thatHistory = [];
  this.inputHistory= [];
  this.requestHistory  = [];
  this.responseHistory = [];
}

module.exports = ChatSession;

if (require.main === module)
{
  console.log("Running ChatSession directly.");
  var session = new ChatSession();

  var Bot = require('./Bot');
  bot = new Bot('alice2', './');
  bot.loadAIMLFiles();
  bot.ee.on('AIML FILES LOADED', function() {

  const readline = require('readline');

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  rl.on('line', (line) => {
    bot.respond(line, session, console.log);
  });

  console.log(">>");
});
}
