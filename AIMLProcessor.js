var xmldom = require('xmldom');
var DOMParser = new xmldom.DOMParser();
var DOMPrinter = new xmldom.XMLSerializer();
var fs = require('fs');
var Config = require('./Config');
var Promise = require("bluebird");

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
  return null;
}

AIMLProcessor.prototype.evalTagContent = function(node, ignoreAttributes)
{
  var promise = ValuePromise("");
  if (node.hasChildNodes())
  {
    for (var i = 0; i < node.childNodes.length; i++)
    {
      if (!ignoreAttributes || ignoreAttributes == [] || ignoreAttributes.indexOf(node.childNodes[i].nodeName) <= -1)
      {
        promise = promise.then(((node) => {
          return (result) => {
            return this.recursEval(node).then((nextResult) => {
              return result + nextResult
            })
          }
        })(node.childNodes[i]));
      }
    }
  }
  return promise;
}

AIMLProcessor.prototype.set = function(node)
{
  var predicateName = this.getAttributeOrTagValue(node, "name");
  var varName       = this.getAttributeOrTagValue(node, "var");
  var promise = this.evalTagContent(node, ["name", "var"])
  .then(((predicateName, varName) => {
    return (result) => {
      result = result.trim().replace(/[\r\n]/g);
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
  })(predicateName, varName));
  return promise;
}

AIMLProcessor.prototype.get = function (node)
{
  var predicateName = this.getAttributeOrTagValue(node, "name");
  var varName       = this.getAttributeOrTagValue(node, "var");
  var promise = new Promise(((fullfill) => {
    if (predicateName)
    {
      result = this.session.predicates.get(predicateName);
    }
    else if (varName)
    {
      result = this.vars.get(varName);
    }
    fullfill(result);
  })(predicateName, varName));
  return promise;
}

AIMLProcessor.prototype.map = function(node)
{
  var mapPromise = this.getAttributeOrTagValue(node, "name").then(
    (mapName) => {
      var promise = this.evalTagContent(node, ["name"])
      .then(((mapName)=> { return (contents) => {
        contents = contents.trim();
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
    })(mapName));
    return promise;
  });
  return mapPromise;
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

function ValuePromise(value) {
  return new Promise((fullfill) => {fullfill(value)});
}

AIMLProcessor.prototype.inputStar = function(node)
{
  var index = parseInt(this.getAttributeOrTagValue(node, "index")) - 1;
  if (!index) { index = 0; }
  return ValuePromise(this.inputStars[index]);
}

AIMLProcessor.prototype.thatStar = function(node)
{
  var index = parseInt(this.getAttributeOrTagValue(node, "index")) - 1;
  if (!index) { index = 0; }
  return ValuePromise(this.thatStars[index]);
}

AIMLProcessor.prototype.topicStar = function(node)
{
  var index = parseInt(this.getAttributeOrTagValue(node, "index")) - 1;
  if (!index) { index = 0; }
  return ValuePromise(this.topicStars[index]);
}

AIMLProcessor.prototype.that = function(node)
{
  var indices = this.getAttributeOrTagValue(node, "index");
  if (!indices) { indices = [0,0] }
  else
  {
    var tmp = indices.split(/,/); // indices should be two comma-separated integers
    indices = [parseInt(tmp[0])-1, parseInt(tmp[1])-1];
  }
  return ValuePromise((this.session.thatHistory[indices[0]] || ['*'])[indices[1]]);
}

AIMLProcessor.prototype.input = function (node) {
  var index = (parseInt(this.getAttributeOrTagValue(node, "index")) || 1) - 1;
  return ValuePromise(this.session.inputHistory[index]);
};

AIMLProcessor.prototype.request = function (node) {
  var index = (parseInt(this.getAttributeOrTagValue(node, "index")) || 1) - 1;
  return ValuePromise(this.session.requestHistory[index]);
};

AIMLProcessor.prototype.response = function (node) {
  var index = (parseInt(this.getAttributeOrTagValue(node, "index")) || 1) - 1;
  return ValuePromise(this.session.responseHistory[index]);
};

AIMLProcessor.prototype.person = function (node)
{
  if (node.hasChildNodes())
  {
    result = this.evalTagContent(node);
  }
  else
  {
    result = ValuePromise(this.inputStars[0]);
  }
  return result.then((response) => {return this.bot.preProcessor.person(response).trim()});
}

AIMLProcessor.prototype.person2 = function (node)
{
  if (node.hasChildNodes())
  {
    result = this.evalTagContent(node);
  }
  else
  {
    result = ValuePromise(this.inputStars[0]);
  }
  return result.then((response) => {return this.bot.preProcessor.person2(response).trim()});
}

AIMLProcessor.prototype.botNode = function (node)
{
  var prop = this.getAttributeOrTagValue(node, "name");
  return ValuePromise(this.bot.properties.get(prop).trim());
}

AIMLProcessor.prototype.normalize = function (node)
{
  var result = this.evalTagContent(node);
  return result.then((response) => {return this.bot.preProcessor.normalize(response)});
}

AIMLProcessor.prototype.denormalize = function (node)
{
  var result = this.evalTagContent(node);
  return result.then((response) => {return this.bot.preProcessor.denormalize(response)});
}

AIMLProcessor.prototype.explode = function (node)
{
  var result = this.evalTagContent(node);
  return result.then((response) => {return response.trim().split(/\s*/).join(' ')});
}

AIMLProcessor.prototype.uppercase = function (node)
{
  var result = this.evalTagContent(node);
  return result.then((response) => {return response.trim().toUpperCase()});
}

AIMLProcessor.prototype.lowercase = function (node)
{
  var result = this.evalTagContent(node);
  return result.then((response) => { response.trim().toLowerCase() });
}

AIMLProcessor.prototype.formal = function(node)
{
  var result = this.evalTagContent(node)
  .then((prevResult) => {
    var response = "";
    prevResult = prevResult.trim().split(/\s+/);
    for (var i = 0; i < prevResult.length; i++) {
      response = response + prevResult[i].charAt(0).toUpperCase()
      + prevResult[i].substring(1) + ' ';
    }
    return response.trim();
  });
  return result;
}

AIMLProcessor.prototype.recurseLearn = function (node)
{
  if (node.nodeName == "#text") { return node.nodeValue }
  else if (node.nodeName == "eval") { return this.evalTagContent( node ) }
  else
  {
    var promise = ValuePromise("");
    // create closure for function that chains results together
    var resultChainer = (child) => {
      return (result) => {
          return this.recurseLearn(child).then((nextResult) => {
            return result + nextResult;
          })
      }
    };

    for (var i = 0; i < node.childNodes.length; i++)
    {
      promise = promise.then(resultChainer(node.childNodes[i]));
    }
    var attrString = "";
    if (node.hasAttributes())
    {
      for (i = 0; i < node.attributes.length; i++)
      {
        attrString = attrString + " " + node.attributes[i].name + "=\"" + node.attributes[i].value + "\"";
      }
    }
    return proimise.then(((nodeName, attrString) => {
      return (result) => {return "<" + nodeName + attrString + ">" + result + "</" + nodeName + ">"}})(node.nodeName, attrString));
  }
}

AIMLProcessor.prototype.learn = function(node)
{
  var children = node.childNodes;
  for (var i = 0; i < children.length; i++)
  {
    var child = children[i];
    if (child.nodeName == "category")
    {
      // console.log("Processing learn category" + DOMPrinter.serializeToString(child));
      var grandkids = child.childNodes;
      var pattern = "", that = "<that>*</that>", template = "";
      for (var j = 0; j < grandkids.length; j++)
      {
        var grandchild = grandkids[j];
        if (grandchild.nodeName == "pattern")
        {
          pattern = this.recurseLearn(grandchild);
        }
        else if (grandchild.nodeName == "that")
        {
          that = this.recurseLearn(grandchild);
        }
        else if (grandchild.nodeName == "template")
        {
          template = this.recurseLearn(grandchild);
        }
      }
      Promise.all([pattern, that, template]).then(((node) => {(results) => {
        var c = {depth: 0, pattern: '*', topic: "*", that: '*', template: '', file: "learn"};
        pattern = AIMLProcessor.trimTag(results[0], "pattern").toUpperCase();
        c.pattern = pattern.replace(/[\n\s]/g, ' ');
        that = AIMLProcessor.trimTag(results[1], "that").toUpperCase();
        c.that = that.replace(/[\n\s]g/, ' ');
        c.template = AIMLProcessor.trimTag(results[2], "template");

        if (node.nodeName == 'learn')
        {
          // console.log("Learning new category for session " + this.session.id);
          c.session_id = this.session.id;
        }

        this.bot.addCategory(c);
      }})(node));
    }
  }
  return ValuePromise("");
}

AIMLProcessor.prototype.loopCondition = function(node)
{
  var chainLoopResult = (node, loopCnt, prevResult) => {
    return (loopResult) => {
      if (loopCnt > Config.MAX_LOOP_COUNT) { throw new Error("Too many loops in condition!"); }
      if (loopResult.indexOf("<loop/>") > -1) {
        return this.condition(node).then(chainLoopResult(node, loopCnt + 1, prevResult + loopResult.replace("<loop/>", "")));
      } else {
        return prevResult + loopResult;
      }
    }
  };

  return this.condition(node).then(chainLoopResult(node, 0, ""));
}

AIMLProcessor.prototype.condition = function(node)
{
  var childList = node.childNodes;
  var lilist = [];
  var ignoreAttrs = ["name", "var", "value"];
  var predicate = this.getAttributeOrTagValue(node, "name");
  var varName   = this.getAttributeOrTagValue(node, "var");
  var value     = this.getAttributeOrTagValue(node, "value");
  for (var i = 0; i < childList.length; i = i+1)
  {
    if (childList[i].nodeName == "li") { lilist.push(childList[i]) }
  }
  if ( (lilist.length) == 0 && value && varName &&
    (this.vars.get(varName).toLowerCase() == value.toLowerCase()) )
  {
    return this.evalTagContent(node, ignoreAttrs);
  }
  else
  {
    for (var i = 0; i < lilist.length; i++)
    {
      var n = lilist[i];
      if (!predicate) { var liPred = this.getAttributeOrTagValue(n, "name") }
      if (!varName) { var liVar = this.getAttributeOrTagValue(n, "var") }
      value = this.getAttributeOrTagValue(n, "value");
      if (!value)
      {
        if (liPred && value && (
          (this.session.predicates.get(liPred).toLowerCase() == value.toLowerCase())
          || (this.session.predicates.has(liPred) && (value == "*") )))
        {
          return this.evalTagContent(n, ignoreAttrs);
        }
        else if (liVar && value && (
          (this.vars.get(liVar).toLowerCase() == value.toLowerCase())
          || (this.vars.has(liVar) && (value == "*") )))
        {
          return this.evalTagContent(n, ignoreAttrs);
        }
      }
      else
      {
        // if we made it here, we must be at the terminal
        // li, so we return it as the default
        return this.evalTagContent(n, ignoreAttrs);
      }
    }
  }
  return ValuePromise("");
}

AIMLProcessor.prototype.date = function(node) {
  var format   = this.getAttributeOrTagValue(node, "format");
  var locale   = this.getAttributeOrTagValue(node, "locale");
  var timezone = this.getAttributeOrTagValue(node, "timezone");
  var strftime = require('strftime');
  // console.log("Date tag with format " + format + " locale " + locale + " timzeone " + timezone);
  var result = strftime.timezone(timezone).localize(locale)(format);
  // console.log("   Result:" + result);
  return ValuePromise(result);
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
  return ValuePromise(result);
}

AIMLProcessor.prototype.srai = function(node)
{
  this.sraiCount = this.sraiCount + 1;
  if (this.sraiCount > Config.MAX_SRAI_DEPTH) { return "Too much recursion!" }
  // console.log("srai redirecting with " + this.evalTagContent( node ).trim().replace(/[\r\n]/g));
  var promise = this.evalTagContent(node).then(
    (result) => {
      result = this.bot.preProcessor.normalize(result.trim().replace(/[\r\n]/g));
      // need to implement topics by way of variables and predicates
      // once that's done, need to check for new topic here
      var matchedNode = this.bot.root.match(result, "*", this.session.predicates.get('topic') || "*");
      if (matchedNode)
      {
        // console.log("srai evaluating " + matchedNode.category.pattern + ", " + matchedNode.category.file);
        var template = "<template>"+matchedNode.category.template+"</template>";
        var root = DOMParser.parseFromString(template).childNodes[0];
        response = this.recursEval(root);
      }
      else
      {
        response = ValuePromsie("ERROR IN SRAI DEPTH " + this.sraiCount);
      }
      this.sraiCount = this.sraiCount - 1;
      return response;
  });
  return promise;
}

  AIMLProcessor.prototype.recursEval = function (node)
{
  if (node.nodeName == "#text") { return ValuePromise(node.nodeValue) }
  else if (node.nodeName == "#comment") { return  ValuePromise("") }
  else if (node.nodeName == "template") { return this.evalTagContent( node ) }
  else if (node.nodeName == "random" ) { return this.random( node ) }
  else if (node.nodeName == "star") { return this.inputStar( node ) }
  else if (node.nodeName == "thatstar") { return this.thatStar( node ) }
  else if (node.nodeName == "topicstar") { return this.topicStar( node ) }
  else if (node.nodeName == "that") { return this.that( node ) }
  else if (node.nodeName == "input") { return this.input( node ) }
  else if (node.nodeName == "request") { return this.request( node ) }
  else if (node.nodeName == "response") { return this.response( node ) }
  else if (node.nodeName == "person") { return this.person(node) }
  else if (node.nodeName == "person2") { return this.person2(node) }
  else if (node.nodeName == "bot") { return this.botNode( node ) }
  else if (node.nodeName == "interval") { return this.interval(node) }
  else if (node.nodeName == "date") { return this.date(node) }
  else if (node.nodeName == "srai") { return this.srai(node) }
  else if (node.nodeName == "sr") { return this.srai(DOMParser.parseFromString("<srai>"+this.inputStars[0]+"</srai>").childNodes[0]) }
  else if (node.nodeName == "set") { return this.set(node) }
  else if (node.nodeName == "map") { return this.map(node) }
  else if (node.nodeName == "get") { return this.get(node) }
  else if (node.nodeName == "think") { this.evalTagContent(node); return ValuePromise(""); }
  else if (node.nodeName == "normalize") { return this.normalize(node) }
  else if (node.nodeName == "denormalize") { return this.denormalize(node) }
  else if (node.nodeName == "explode") { return this.explode(node) }
  else if (node.nodeName == "formal") { return this.formal(node) }
  else if (node.nodeName == "uppercase") { return this.uppercase(node) }
  else if (node.nodeName == "lowercase") { return this.lowercase(node) }
  else if (node.nodeName == "condition") { return this.loopCondition(node) }
  else if (node.nodeName == "learn") { return this.learn(node) }
  else { return ValuePromise(DOMPrinter.serializeToString(node)) }
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
