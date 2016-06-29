AIML2.js
=======

AIML 2.0 Interpreter written in node.js<br/>
<br/>
AIMLInterpreter is a module that allows you to parse AIML files and to find the correct answer to a given message.<br/>

<b>Dependencies</b><pre>
xmldom
eventemitter
readline
strftime</pre>
<br/>
<b>Description</b><br/>
Although this is a fork of [aimlinterpreter](https://github.com/raethlein/AIML.js) almost none of that code has been retained. The new code is mostly based on the reference implementation for AIML2.0, [Program AB](https://code.google.com/archive/p/program-ab/), which was written in Java. AIML2 is not a direct copy as many of the structures that exist in Java do not in node.js and vice versa. Additionally, where structural changes make the code more efficient, or, more importantly, easier to understand, I have attempted to do so.

It's a large project so I expect there will be many changes along the way. Additionally, AIML 2.0 is still only a draft specification, so changes may be made there. As far as I know, this should be backward compatible with AIML 1.* files, bt I have not done any testing of that yet.

If you're interested in contributing or are looking for support, find me on [twitter](https://twitter.com/TerribleNews).

Usage
=========

Currently, you can test it out by simply running
<pre><code>
node ChatServer.js
</code></pre>
which will fire up the default alice2 bot with an interactive console session.

If you want to use it in a program, there's currently an example in the file trie_test.js. You will need to create a bot, give it a name and a root directory, and create at least one session.  For example, if your aiml files are in <code>./bots/alice2/aiml</code>, you can create a new bot thusly:
<pre><code>
var Bot = require('./Bot');
var bot = new Bot('alice2', './');
bot.loadAIMLFiles();
</code></pre>
and to ask the bot questions, you must have some kind of ChatSession and a callback function for handling the response. Since console.log is a function, we can just pass that as the callback in a really simple example.
<pre><code>
var ChatSession = require('./ChatSession');
var session = new ChatSession();

bot.respond("Hello!", session, console.log);
</pre></code>
