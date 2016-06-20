var xmldom = require('xmldom');
var DOMParser = new xmldom.DOMParser();
var DOMPrinter = new xmldom.XMLSerializer();
var fs = require('fs');

function AIMLProcessor(template, inputStars, thatStars, topicStars, session, bot) {
  this.template = template;
  this.inputStars = inputStars;
  this.thatStars = thatStars;
  this.topicStars = topicStars;
  this.session = session;
  this.bot = bot;
  this.vars = new Map();
  this.sraiCount = 0;
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
      // console.log("Found template tag: " + DOMPrinter.serializeToString(m));
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

// takes a filename and a callback function which takes an array of categories
function  AIMLToCategories(filename, callback) {

  // load the file into a single string and process it with xmldom
  fs.readFile(filename, {encoding:'utf-8'}, function(err, aiml_string) {
    // Return an Array of categories
    var categories = new Array();

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
          // console.log("Adding node " + i);
          categories.push(c);
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
              categories.push(c);
            }
          }
        }
      }
    }
    callback(categories);
  });
}

AIMLProcessor.prototype.getAttributeOrTagValue = function (node, attrName)
{
  var result = "";
  if (node.hasAttribute(attrName)) {
    return node.getAttribute(attrName)
  }
  for (var i = 0; i < node.childNodes.length; i++)
  {
    var n = node.childNodes[i];
    if (n.nodeName == attrName) {
      return this.evalTagContent( n )
    }
  }
}

AIMLProcessor.prototype.evalTagContent = function(node, ignoreAttributes)
{
  var result = "";
  if (node.hasChildNodes())
  {
    for (var i = 0; i < node.childNodes.length; i++)
    {
      if (!ignoreAttributes || ignoreAttributes == [] || ignoreAttributes.indexOf(node.childNodes[i].nodeName) <= -1)
      {
        result = result + this.recursEval(node.childNodes[i]);
      }
    }
  }
  return result;
}

AIMLProcessor.prototype.set = function(node)
{
  var predicateName = this.getAttributeOrTagValue(node, "name");
  var varName       = this.getAttributeOrTagValue(node, "var");
  var result = this.evalTagContent(node, ["name", "var"]).trim().replace(/[\r\n]/g);
  if (predicateName)
  {
    this.session.predicates.set(predicateName, result);
  }
  else if (varName)
  {
    this.vars.set(varName, result);
  }
  if (this.bot.sets.get("pronoun").indexOf(predicateName) > - 1)
  {
    result = predicateName; // what?
  }
  return result;
}

AIMLProcessor.prototype.get = function (node)
{
  var predicateName = this.getAttributeOrTagValue(node, "name");
  var varName       = this.getAttributeOrTagValue(node, "var");
  var result;
  if (predicateName)
  {
    result = this.session.predicates.get(predicateName);
  }
  else if (varName)
  {
    result = this.vars.get(varName);
  }
  return result;
}

AIMLProcessor.prototype.map = function(node)
{
  var mapName = this.getAttributeOrTagValue(node, "name");
  var contents = this.evalTagContent(node, ["name"]).trim();
  if (!mapName)
  {
    result = "<map>"+contents+"</map>";
  }
  else
  {
    map = this.bot.maps.get(mapName);
    if (map)
    {
      result = map.get(contents.toUpperCase()).trim();
    }
  }
  return result;
}

AIMLProcessor.prototype.random = function(node)
{
  var liList = [];
  for (var i = 0; i < node.childNodes.length; i++)
  {
    var n = node.childNodes[i];
    if (n.nodeName == "li")
    {
      liList.push(n)
    }
  }
  var r = Math.floor(Math.random() * liList.length);
  return this.evalTagContent(liList[r]);
}

AIMLProcessor.prototype.inputStar = function(node)
{
  var index = this.getAttributeOrTagValue(node, "index") - 1;
  if (!index) { index = 0; }
  return this.inputStars[index];
}

AIMLProcessor.prototype.thatStar = function(node)
{
  var index = this.getAttributeOrTagValue(node, "index") - 1;
  if (!index) { index = 0; }
  return this.thatStars[index];
}

AIMLProcessor.prototype.topicStar = function(node)
{
  var index = this.getAttributeOrTagValue(node, "index") - 1;
  if (!index) { index = 0; }
  return this.topicStars[index];
}

AIMLProcessor.prototype.botNode = function (node)
{
  var prop = this.getAttributeOrTagValue(node, "name");
  return this.bot.properties.get(prop).trim();
}

AIMLProcessor.prototype.normalize = function (node)
{
  var result = this.evalTagContent(node);
  return this.bot.preProcessor.normalize(result);
}

AIMLProcessor.prototype.denormalize = function (node)
{
  var result = this.evalTagContent(node);
  return this.bot.preProcessor.denormalize(result);
}

AIMLProcessor.prototype.explode = function (node)
{
  var result = this.evalTagContent(node);
  return result.trim().split(/\s*/).join(' ');
}

AIMLProcessor.prototype.uppercase = function (node)
{
  var result = this.evalTagContent(node);
  return result.trim().toUpperCase();
}

AIMLProcessor.prototype.lowercase = function (node)
{
  var result = this.evalTagContent(node);
  return result.trim().toLowerCase();
}

AIMLProcessor.prototype.formal = function(node)
{
  var result = this.evalTagContent(node).trim().split(/\s+/);
  var response = '';
  for (var i = 0; i < result.length; i++) {
    response = response + result[i].charAt(0).toUpperCase()
      + result[i].substring(1) + ' ';
  }
  return response;
}

AIMLProcessor.prototype.date = function(node) {
  var format   = this.getAttributeOrTagValue(node, "format");
  var locale   = this.getAttributeOrTagValue(node, "locale");
  var timezone = this.getAttributeOrTagValue(node, "timezone");
  var strftime = require('strftime');
  // console.log("Date tag with format " + format + " locale " + locale + " timzeone " + timezone);
  var result = strftime.timezone(timezone).localize(locale)(format);
  // console.log("   Result:" + result);
  return result;
}

AIMLProcessor.prototype.interval = function(node) {
  // console.log(DOMPrinter.serializeToString(node));
  var style  = this.getAttributeOrTagValue(node, "style");
  var format = this.getAttributeOrTagValue(node, "format");
  var from   = Date.parse(this.getAttributeOrTagValue(node, "from"));
  var to     = Date.parse(this.getAttributeOrTagValue(node, "to"));
  // console.log("Looking for interval between " + from + ' and ' + to);
  if (style == null)   { style = "years" }
  if (format == null) { format = "%B %d, %Y"; }
  if (from == null)    { from = Date.parse("January 1, 1970") }
  if (to == null)      { to = new Date()}
  var delta = new Date(to - from);
  var result = "unknown";
  if (style == "years")  { result = ""+Math.floor(delta.getYear()-70) }
  if (style == "months") { result = ""+Math.floor( (delta.getYear()-70)*12 + delta.getMonth() ) }
  if (style == "days")   { result = ""+Math.floor( delta.valueOf() / (24*60*60*1000) ) }
  if (style == "hours" ) { result = ""+Math.floor( delta.valueOf() / (60*60*1000) ) }
  return result
}

AIMLProcessor.prototype.srai = function(node)
{
  this.sraiCount = this.sraiCount + 1;
  if (this.sraiCount > 10) { return "Too much recursion!" }
  var result = this.bot.preProcessor.normalize(this.evalTagContent( node ).trim().replace(/[\r\n]/g));
  // need to implement topics by way of variables and predicates
  // once that's done, need to check for new topic here
  var matchedNode = this.bot.root.match(result, "*", "*");
  if (matchedNode)
  {
    // console.log("srai evaluating " + matchedNode.category.pattern + ", " + matchedNode.category.file);
    var template = "<template>"+matchedNode.category.template+"</template>";
    var root = DOMParser.parseFromString(template).childNodes[0];
    response = this.recursEval(root);
  }
  else
  {
    response = "ERROR IN SRAI DEPTH " + this.sraiCount;
  }
  this.sraiCount = this.sraiCount - 1;
  return response.trim();

}

AIMLProcessor.prototype.recursEval = function (node)
{
  if (node.nodeName == "#text") { return node.nodeValue }
  else if (node.nodeName == "#comment") { return "" }
  else if (node.nodeName == "template") { return this.evalTagContent( node ) }
  else if (node.nodeName == "random" ) { return this.random( node ) }
  else if (node.nodeName == "star") { return this.inputStar( node ) }
  else if (node.nodeName == "thatstar") { return this.inputStar( node ) }
  else if (node.nodeName == "topicstar") { return this.inputStar( node ) }
  else if (node.nodeName == "bot") { return this.botNode( node ) }
  else if (node.nodeName == "interval") { return this.interval(node) }
  else if (node.nodeName == "date") { return this.date(node) }
  else if (node.nodeName == "srai") { return this.srai(node) }
  else if (node.nodeName == "sr") { return this.srai(DOMParser.parseFromString("<srai>"+this.inputStars[0]+"</srai>").childNodes[0]) }
  else if (node.nodeName == "set") { return this.set(node) }
  else if (node.nodeName == "map") { return this.map(node) }
  else if (node.nodeName == "get") { return this.get(node) }
  else if (node.nodeName == "think") { this.evalTagContent(node); return ""; }
  else if (node.nodeName == "normalize") { return this.normalize(node) }
  else if (node.nodeName == "denormalize") { return this.denormalize(node) }
  else if (node.nodeName == "explode") { return this.explode(node) }
  else if (node.nodeName == "formal") { return this.formal(node) }
  else if (node.nodeName == "uppercase") { return this.uppercase(node) }
  else if (node.nodeName == "lowercase") { return this.lowercase(node) }
  else { return DOMPrinter.serializeToString(node) }
}

AIMLProcessor.prototype.evalTemplate = function () {
  var response = "";
  var template = "<template>"+this.template+"</template>";
  var root = DOMParser.parseFromString(template).childNodes[0];
  response = this.recursEval(root);
  return response;
}

// Static functions
AIMLProcessor.trimTag =  trimTag;
AIMLProcessor.AIMLToCategories = AIMLToCategories;

module.exports = AIMLProcessor;
