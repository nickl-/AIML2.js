var xmldom = require('xmldom');
var DOMParser = new xmldom.DOMParser();
var DOMPrinter = new xmldom.XMLSerializer();
var fs = require('fs');

function AIMLProcessor() {
  this.categories = [];
}


function trimTag(serializedXML, tagName)
{
    // pull the middle bit out of this XML with a regexp
    var startTag = "<" + tagName + ">",
      endTag = "</" + tagName + ">";
    // console.log("Stripping ", tagName, " tags from ", serializedXML);
    if (serializedXML.startsWith(startTag) &&
        serializedXML.endsWith(endTag))
    {
      // if there was a match, the full match is in
      // matched[0] and the first bracket matched is in matched[1]
      return serializedXML.substr(startTag.length, serializedXML.length - startTag.length - endTag.length);
    }
}
function categoryProcessor(node, topic, filename, language)
{
  // console.log("Processing category node ", DOMPrinter.serializeToString(node));
  var c = {depth: 0, pattern: '*', topic: topic, that: '*', template: '', file: filename};
  for (var i = 0; i < node.childNodes.length; i++)
  {
    var m = node.childNodes[i];
    var mName = m.nodeName;
    if (mName == '#text') {/*skip*/}
    else if (mName == "pattern")
    {
      c.pattern = trimTag(DOMPrinter.serializeToString(m), 'pattern')
        .replace(/[\r\n]/g, '').replace(/\s+/g, ' ').trim();
    }
    else if (mName == "that")
    {
      c.that = trimTag(DOMPrinter.serializeToString(m), 'that')
        .replace(/[\r\n]/g, '').replace(/\s+/g, ' ').trim();
    }
    else if (mName == "topic")
    {
      c.topic = trimTag(DOMPrinter.serializeToString(m), 'topic')
        .replace(/[\r\n]/g, '').replace(/\s+/g, ' ').trim();
    }
    else if (mName == "template")
    {
      console.log("Found template tag: " + DOMPrinter.serializeToString(m));
      c.template = trimTag(DOMPrinter.serializeToString(m), 'template').trim();
    }
    else
    {
      console.log("categoryProcessor: unexpected <" + mName + "> in file ", filename);
    }
  }
  if (!c.template)
  {
    return null;
  }
  else
  {
      return c;
  }
}

AIMLProcessor.prototype.AIMLToCategories = function (filename) {
  // load the file into a single string
  var aiml_string = fs.readFileSync(filename, {encoding:'utf-8'});
  var language = 'english'; // should define a default somewhere

  // parse the string but get rid of the newlines because we dont't need them
  var doc = DOMParser.parseFromString(aiml_string);
  var aiml = doc.getElementsByTagName('aiml');
  if (aiml.length > 1)
  {
    throw new Error("Too many aiml nodes in file " + filename);
  }
  else
  {
    aiml = aiml[0];
  }

  if (aiml.hasAttribute('language'))
  {
    language = aiml.getAttribute('language');
  }
  for (var i = 0; i < aiml.childNodes.length; i++)
  {
    var n = aiml.childNodes[i];
    if (n.nodeName == 'category') {
      var c = categoryProcessor(n, '*', filename, language);
      if (c)
      {
        console.log("Adding ndoe " + i);
        this.categories.push(c);
      }
      else
      {
        console.log("Discarding category at node " + i);
      }
    }
    else if (n.nodeName == "topic")
    {
      var topic = n.getAttribute('name');
      for (var j = 0; j < n.childNodes.length; j++)
      {
          var m = n.childNodes[j];
          if (m.nodeName == 'category')
          {
            var c = categoryProcessor(m, topic, filename, language);
            if (c)
            {
              this.categories.push(c);
            }
          }
      }
    }
  }
}

module.exports = AIMLProcessor;
