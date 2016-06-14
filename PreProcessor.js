var EE = require('EventEmitter').EventEmitter;
var readline = require('readline');

// this will need to be replaced with a require when the MagicStrings file is created
var MagicStrings = {text_comment_mark: ';;'};

var FILES_TO_LOAD = 5;

function PreProcessor(bot) {
  this.bot = bot;
  this.loaded = 0;
  this.ready = false;
  this.ee = new EE();

  if (bot.config_path) { var path = bot.config_path }
  else { var path = './bots/alice2/config' }

  var normalPatterns = [];
  var normalSubs = [];
  this.normalCount = readSubstitutions(path+"/normal.txt", normalPatterns, normalSubs);
  this.normalPatterns = normalPatterns;
  this.normalSubs = normalSubs;

  var denormalPatterns = [];
  var denormalSubs = [];
  this.denormalCount = readSubstitutions(path+"/denormal.txt", denormalPatterns, denormalSubs);
  this.denormalPatterns = denormalPatterns;
  this.denormalSubs = denormalSubs;

  var personPatterns = [];
  var personSubs = [];
  this.personCount = readSubstitutions(path+"/person.txt", personPatterns, personSubs);
  this.personPatterns = personPatterns;
  this.personSubs = personSubs;

  var person2Patterns = [];
  var person2Subs = [];
  this.person2Count = readSubstitutions(path+"/person2.txt", person2Patterns, person2Subs);
  this.person2Patterns = person2Patterns;
  this.person2Subs = person2Subs;

  var genderPatterns = [];
  var genderSubs = [];
  this.genderCount = readSubstitutions(path+"/gender.txt", genderPatterns, genderSubs);
  this.genderPatterns = genderPatterns;
  this.genderSubs = genderSubs;

}

function readSubstitutions(filename, patterns, subs)
{
  var rl = readline.createInterface({
    input: fs.createReadStream(filename)
  });

  var count = 0;
  rl.on('line', (line) => {
    var count = 0;
    line = line.trim();
    if (!line.startsWith(MagicStrings.text_comment_mark))
    {
      var match = line.match(/"(.*?)","(.*?)"/);
      if (match)
      {
        // these are meant to be literal repalcementts so we need to escape
        // special regexp characters
        pattern = match[1].replace(/([\.\*\?\+\\\(\)\[\]])/g, '\\$1');
        patterns.push(new RegExp(pattern, "gi"));
        subs.push(match[2]);
        count++;
      }
    }
  });

  rl.on('close', () => {
    this.loaded = this.loaded + 1;
    if (this.loaded == FILES_TO_LOAD)
    {
      this.ready = true;
      this.ee.emit('loaded')
    }
  });
  return count; // this doesn't actually work because of callbacks and events and stuff. I think a Promise might be a way to fix it but I don't really understand promises yet.
}

function substitute(sentence, patterns, subs) {
  sentence = " " + sentence + " ";
  for (var i = 0; i < patterns.length; i++)
  {
    // perform each substitution on the string
    sentence = sentence.replace(patterns[i], subs[i]);
  }
  sentence = sentence.replace(/\s+/, ' '); // replace multiple spaces
  return sentence.trim();
}

PreProcessor.prototype.normalize = function (sentence) {
  return substitute(sentence, this.normalPatterns, this.normalSubs);
}
module.exports = PreProcessor;
