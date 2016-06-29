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
Although this is a fork of [aimlinterpreter](https://github.com/raethlein/AIML.js) almost none of that code has been retained. The new code is mostly based on the reference implementation for AIML2.0, (Program AB)[https://code.google.com/archive/p/program-ab/], which was written in Java. AIML2 is not a direct copy as many of the structures that exist in Java do not in node.js and vice versa. Additionally, where structural changes make the code more efficient, or, more importantly, easier to understand, I have attempted to do so.

It's a large project so I expect there will be many changes along the way. Additionally, AIML 2.0 is still only a draft specification, so changes may be made there. As far as I know, this should be backward compatible with AIML 1.* files, bt I have not done any testing of that yet.

If you're interested in contributing or are looking for support, find me on (twitter)[https://twitter.com/TerribleNews].

Usage
=========

Currently, you can test it out by simply running
<code>
>> node ChatServer.js
</code>
which will fire up the default alice2 bot with an interactive console session.
