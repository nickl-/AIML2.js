var xmldom = require('xmldom');
var DOMParser = new xmldom.DOMParser();
var DOMPrinter = new xmldom.XMLSerializer();
var fs = require('fs');
var Config = require('./Config');
var Promise = require("bluebird");
var https = require('https');

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
  if (node.hasAttribute(attrName)) {
    return ValuePromise(node.getAttribute(attrName))
  }
  for (var i = 0; i < node.childNodes.length; i++)
  {
    var n = node.childNodes[i];
    if (n.nodeName == attrName) {
      return this.evalTagContent( n )
    }
  }
  return ValuePromise(null);
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

AIMLProcessor.prototype.unevaluatedXML = function (node)
{
  return this.evalTagContent(node).then(
    ((node)=>{
      return (result) => {
        var attrString = "";
        if (node.hasAttributes())
        {
          for (i = 0; i < node.attributes.length; i++)
          {
            attrString = attrString + " " + node.attributes[i].name + "=\"" + node.attributes[i].value + "\"";
          }
        }
        if (result)
        {
          return "<" + node.nodeName + attrString + ">" + result + "</" + node.nodeName + ">"
        }
        else
        {
          return "<" + node.nodeName + attrString + "/>"
        }
      }
    })(node)
  )
}

AIMLProcessor.prototype.set = function(node)
{
  var predicatePromise = this.getAttributeOrTagValue(node, "name").then(
    (predicateName) => {
      var varPromise       = this.getAttributeOrTagValue(node, "var").then(
        (varName) => {
          var promise = this.evalTagContent(node, ["name", "var"])
          .then(((predicateName, varName) => {
            return (result) => {
              result = result.trim().replace(/[\r\n]/g);
              // console.log("Setting " + (predicateName || varName) + " to " + result);
              if (predicateName)
              {
                this.session.predicates.set(predicateName, result);
              }
              else if (varName)
              {
                this.vars.set(varName, result);
              }
              if (this.bot.sets.get("pronoun").has(predicateName))
              {
                result = predicateName; // what?
              }
              return result;
            }
        })(predicateName, varName));
        return promise;
    });
    return varPromise;
  });
  return predicatePromise;
}

AIMLProcessor.prototype.get = function (node)
{
  var predicatePromise = this.getAttributeOrTagValue(node, "name")
  .then((predicateName) => {
  var varPromise       = this.getAttributeOrTagValue(node, "var")
  .then((varName) => {
  var promise = new Promise(((predicateName, varName) => {return (fullfill) => {
    if (predicateName)
    {
      result = this.session.predicates.get(predicateName);
    }
    else if (varName)
    {
      result = this.vars.get(varName);
    }
    if (!result)
    {
      result = this.bot.properties.get("default-get") || "unknown";
    }
    fullfill(result);
  }})(predicateName, varName));
  return promise;
  });
  return varPromise;
  });
  return predicatePromise;
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
            result = map.get(contents.toUpperCase());
          }
        }
        if (!result)
        {
          result = this.bot.properties.get("default-map");
        }
        return result.trim();
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
  return this.getAttributeOrTagValue(node, "index").
  then((value) =>
  {
    // console.log("<star index=\""+value+"\"/>");
    var index = parseInt(value) - 1;
    if (!index) { index = 0; }
    // console.log("Returning " + this.inputStars[index]);
    return this.inputStars[index];
  });
}

AIMLProcessor.prototype.thatStar = function(node)
{
  return this.getAttributeOrTagValue(node, "index").
  then((value) =>
  {
    var index = parseInt(value) - 1;
    if (!index) { index = 0; }
    return this.thatStars[index];
  });
}

AIMLProcessor.prototype.topicStar = function(node)
{
  return this.getAttributeOrTagValue(node, "index").
  then((value) =>
  {
    var index = parseInt(value) - 1;
    if (!index) { index = 0; }
    return this.topicStars[index];
  });
}

AIMLProcessor.prototype.that = function(node)
{
  return this.getAttributeOrTagValue(node, "index")
  .then((indices) => {
    if (!indices) { indices = [0,0] }
    else
    {
      var tmp = indices.split(/,/); // indices should be two comma-separated integers
      indices = [parseInt(tmp[0])-1, parseInt(tmp[1])-1];
    }
    return (this.session.thatHistory[indices[0]] || ['*'])[indices[1]];
  });
}

AIMLProcessor.prototype.input = function (node) {
  return this.getAttributeOrTagValue(node, "index").
  then((value) =>
  {
    var index = (parseInt(value) || 1) - 1;
    if (!index) { index = 0; }
    return this.session.inputHistory[index];
  });
}

AIMLProcessor.prototype.request = function (node) {
  return this.getAttributeOrTagValue(node, "index").
  then((value) =>
  {
    var index = (parseInt(value) || 1) - 1;
    if (!index) { index = 0; }
    return this.session.requestHistory[index];
  });
}

AIMLProcessor.prototype.response = function (node) {
  return this.getAttributeOrTagValue(node, "index").
  then((value) =>
  {
    var index = (parseInt(value) || 1) - 1;
    if (!index) { index = 0; }
    return this.session.responseHistory[index];
  });
}

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
  var promise = this.getAttributeOrTagValue(node, "name")
  .then((prop) => {
  return ValuePromise(
    (
      this.bot.properties.get(prop) ||
      this.bot.properties.get("default-property") ||
      "unknown"
    ) .trim());
  });
  return promise;
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

AIMLProcessor.prototype.first = function (node)
{
    var result = this.evalTagContent(node)
    .then((result) =>
    {
      return result.trim().split(/\s+/)[0];
    });
    return result;
}

AIMLProcessor.prototype.rest = function (node)
{
    var result = this.evalTagContent(node)
    .then((result) =>
    {
      return result.trim().split(/\s+/).slice(1).join(' ');
    });
    return result;
}

AIMLProcessor.prototype.recurseLearn = function (node)
{
  if (node.nodeName == "#text") { return ValuePromise(node.nodeValue) }
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
    return promise.then(((nodeName, attrString) => {
      return (result) => {return "<" + nodeName + attrString + ">" + result + "</" + nodeName + ">"}})(node.nodeName, attrString));
  }
}

AIMLProcessor.prototype.learn = function(node)
{
  var children = node.childNodes;
  var promise = ValuePromise("");
  for (var i = 0; i < children.length; i++)
  {
    var child = children[i];
    promise = promise.then( ( (node, child) => {

      return (result) => {
        if (child.nodeName == "category")
        {
          // console.log("Processing learn category" + DOMPrinter.serializeToString(child));
          var grandkids = child.childNodes;
          var pattern = ValuePromise(""), that = ValuePromise("<that>*</that>"), template = ValuePromise("");
          for (var j = 0; j < grandkids.length; j++)
          {
            var grandchild = grandkids[j];
            if (grandchild.nodeName == "pattern")
            {
              pattern = this.recurseLearn(grandchild).catch((err)=>{console.log("Error with recruseLearn pattern")});
            }
            else if (grandchild.nodeName == "that")
            {
              that = this.recurseLearn(grandchild).catch((err)=>{console.log("Error with recruseLearn that")});
            }
            else if (grandchild.nodeName == "template")
            {
              template = this.recurseLearn(grandchild).catch((err)=>{console.log("Error with recruseLearn template")});
            }
          }
          // console.log("Creating promise to learn something.");
          return Promise.all([pattern, that, template]).then(((node) => {return (results) => {
            var c = {depth: 0, pattern: '*', topic: "*", that: '*', template: '', file: "learn"};
            pattern = AIMLProcessor.trimTag(results[0], "pattern").toUpperCase();
            c.pattern = pattern.replace(/[\n\s]/g, ' ');
            that = AIMLProcessor.trimTag(results[1], "that").toUpperCase();
            c.that = that.replace(/[\n\s]g/, ' ');
            c.template = AIMLProcessor.trimTag(results[2], "template");

            // console.log("Learning new cateory: <pattern>" + c.pattern + "</pattern>");
            // console.log("     <that>" + c.that + "</that>");
            // console.log("     <template>" + DOMPrinter.serializeToString(c.template) + "</template>");
            //
            if (node.nodeName == 'learn')
            {
              // console.log("Learning new category for session " + this.session.id);
              c.session_id = this.session.id;
            }

            this.bot.addCategory(c);
            return "";
          }})(node)).catch((err)=>{console.log("Errr earnin: "+err); console.log(err.stack)});
        }
        else
        {
            return result.trim();
        }
      }
    })(node, child) );
  }
  return promise;
}

AIMLProcessor.prototype.loopCondition = function(node)
{
  var chainLoopResult = (node, loopCnt, prevResult) => {
    // console.log("Creating new chain loop result handler. PrevResult: \""+prevResult+"\"");
    return (loopResult) => {
      // console.log("Got loop result: \"" + loopResult+"\"");
      // console.log("Prev result: \"" + prevResult+"\"");
      // console.log("Returning loop iteration at count " + loopCnt);
      if (loopResult == null) { return prevResult; } // I"m not sure if this is right, but it will keep the next line from throwing an error
      if (loopCnt > Config.MAX_LOOP_COUNT) { throw new Error("Too many loops in condition!"); }
      if (loopResult.indexOf("<loop/>") > -1) {
        // console.log("Found <loop/>. Repeating.");
        return this.condition(node).then(chainLoopResult(node, loopCnt + 1, prevResult + loopResult.replace("<loop/>", "").trim()));
      } else {
        // console.log("No <loop/> found. Returning");
        return prevResult + loopResult;
      }
    }
  };

  return this.condition(node).then(chainLoopResult(node, 0, ""));
}

/*
 * The condition tag has a 2 forms:
 * a) where the condition has a value, in which case it either returns
 *    an empty string if the value doesn't match and the contents of the
 *    tag if it does
 * b) where the condition doesn't have a value, in which has it has <li>
 *    child tags. The interpreter should check the value in each li
 *    for a match. If it matchs, no further <li>s are checked and the
 *    contents of the matchin <li> are returned. There's also the options
 *    of a final <li> tag with no value which is only evaluated if no other
 *    <li> tags match
 */
AIMLProcessor.prototype.condition = function(node)
{

  var predicate = this.getAttributeOrTagValue(node, "name");
  var varName   = this.getAttributeOrTagValue(node, "var");
  var value     = this.getAttributeOrTagValue(node, "value");
  return Promise.all([predicate, varName, value])
  .then(((node) => {return (attrs) => {
    var childList = node.childNodes;
    var lilist = [];
    var ignoreAttrs = ["name", "var", "value"];

    var predicate = attrs[0],
    varName     = attrs[1],
    value       = attrs[2];
    for (var i = 0; i < childList.length; i = i+1)
    {
      if (childList[i].nodeName == "li") { lilist.push(childList[i]) }
    }
    if ( (lilist.length) == 0 && value &&
          ((varName &&
            ((this.vars.get(varName) ||
            this.bot.properties.get("default-get") ||
            "unknown").toLowerCase() == value.toLowerCase())) ||
          (predicate &&
          ((this.session.predicates.get(predicate) ||
          this.bot.properties.get("default-get") ||
          "unknown").toLowerCase() == value.toLowerCase()))) )
    {
      // this is case a) where the condition has a value and it matches
      return this.evalTagContent(node, ignoreAttrs);
    }
    else
    {
      // we start with a promise that returns null so it doesn't look like
      // a previous <li> in the list returned a result
      var promise = ValuePromise(null);
      for (var i = 0; i < lilist.length; i++)
      {
        var n = lilist[i];
        promise = promise.then(((n) => {
          return (result) => {
            // if a previous iteratin of the for loop returned a result
            // then this won't be null (this is important in case a previous
            // <li> returned an empty string; in that case we should still not
            // evaluate any subsequent tags.)
            // just pass it alon and don't do anything else
            if (result != null) {
              return result;
            }
            // because of the promise chain, we need to check for these at the lI value
            // before we do the check at the condition level
            var liPred = this.getAttributeOrTagValue(n, "name");
            var liVar = this.getAttributeOrTagValue(n, "var");
            var liValue = this.getAttributeOrTagValue(n, "value");
            var liPromise = Promise.all([liPred, liVar, liValue])
            .then(((predicate, varName, value, n)=>
            {
              return (liattrs) => {
                var liPred = liattrs[0],
                liVar = liattrs[1],
                value = liattrs[2];
                if (value)
                {
                  if ((predicate || liPred) && value && (
                    ((this.session.predicates.get(predicate || liPred) ||
                    this.bot.properties.get("default-get") ||
                    "unknown").toLowerCase() == value.toLowerCase())
                    || (this.session.predicates.has(predicate || liPred) && (value == "*") )
                  ))
                  {
                    // console.log("returning with li because value matched predicate " + predicate);
                    return this.evalTagContent(n, ignoreAttrs);
                  }
                  else if ((varName || liVar) && value && (
                    ((this.vars.get(varName || liVar) ||
                    this.bot.properties.get("default-get") ||
                    "unknown").toLowerCase() == value.toLowerCase())
                    || (this.vars.has(varName || liVar) && (value == "*")
                  )))
                  {
                    // console.log("returning with li because value matched variable " + varName);
                    return this.evalTagContent(n, ignoreAttrs);
                  }
                  return null;
                }
                else
                {
                  // if we made it here, we must be at the terminal
                  // li, so we return it as the default
                  // console.log("Returning final li");
                  return this.evalTagContent(n, ignoreAttrs);
                }
              }
            })(predicate, varName, value, n));
            return liPromise;
          }})(n));
        } // if nobody returned anything, then we should return an empty string
        return promise.then((result) => { if (result == null) return ""; else return result });
      }
    }
  })(node));
}

AIMLProcessor.prototype.date = function(node) {
  var formatPromise   = this.getAttributeOrTagValue(node, "format");
  var localePromise   = this.getAttributeOrTagValue(node, "locale");
  var timezonePromise = this.getAttributeOrTagValue(node, "timezone");
  return Promise.all([formatPromise, localePromise, timezonePromise])
  .then((attrs) => {
    var format = attrs[0], locale = attrs[1], timezone = attrs[2];
    var strftime = require('strftime');
    // console.log("Date tag with format " + format + " locale " + locale + " timzeone " + timezone);
    var result = strftime.timezone(timezone).localize(locale)(format);
    // console.log("   Result:" + result);
    return result;
  });
}

AIMLProcessor.prototype.interval = function(node) {
  // console.log(DOMPrinter.serializeToString(node));
  var style  = this.getAttributeOrTagValue(node, "style");
  var format = this.getAttributeOrTagValue(node, "format");
  var from   = this.getAttributeOrTagValue(node, "from");
  var to     = this.getAttributeOrTagValue(node, "to");
  return Promise.all([style, format, from, to])
  .then((attrs) => {
    var style = attrs[0],
      format  = attrs[1],
      from = Date.parse(attrs[2]),
      to   = Date.parse(attrs[3]);
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
    return result;
  });
}

AIMLProcessor.prototype.srai = function(node)
{
  if (this.sraiCount > Config.MAX_SRAI_DEPTH) { return ValuePromise("Too much recursion!") }
  var promise = this.evalTagContent(node).then(
    (result) => {
      result = this.bot.preProcessor.normalize(result.trim().replace(/[\r\n]/g));
      // console.log("srai redirecting with \"" + result+ "\" at depth " + this.sraiCount);
      // need to implement topics by way of variables and predicates
      // once that's done, need to check for new topic here
      var matchedNode = this.bot.root.match(result, (this.session.thatHistory[0] || ["*"])[0], this.session.predicates.get('topic') || "*");
      if (matchedNode)
      {
        if (Array.isArray(matchedNode.categor))
        {
          var catgories = matchedNode.category;
        }
        else
        {
          var categories = [matchedNode.category];
        }
        var responseHolder = ValuePromise("");
        for (category of categories)
        {
          if (!category.session_id || category.session_id == this.session.id)
          {
            // console.log("srai evaluating " + category.pattern + ", " + category.file);
            var ap = new AIMLProcessor(category.template, matchedNode.inputStars, matchedNode.thatStars, matchedNode.topicStars, this.session, this.bot);
            ap.sraiCount = this.sraiCount + 1;
            responseHolder = responseHolder.then(((ap) =>
            {
              return (response) => {
                return ap.evalTemplate().then(function (nextResponse)
                {
                  return response + " " + nextResponse;
                })
              }
            })(ap))
            .catch(((cat, cnt) => { return (err) => {
              console.log(category.pattern + ' at depth ' + cnt);
              throw err;
            }})(category, this.sraiCount+1));
          }
        }
        return responseHolder;
    }
  });
  return promise
}

function sraixPannous(input, hint)
{
  // undo smoe of the preprocessing. CAn we not just denormaliz?
  input = input.replace(/ point /g, ".")
  .replace(/ rparen /g, ")")
  .replace(/ lparen /g, "(")
  .replace(/ splash /g, "/")
  .replace(/ star /g, "*")
  .replace(/ dash /g, "-")
  .trim()
  // prepare for URL encoding
  .replace(/ /g, "+");
  function requestMaker(input, hint) {
    return function(resolve, reject)
    {
      var options = {
        host: "ask.pannous.com",
        path: "/api?input="+input,
        rejectUnauthorized: false,
      };
      console.log("Please wait while I check another source");
      var request = https.get(options, function (response)
      {
        var body = "";
        response.on("data", function (chunk)
        {
          body = body + chunk;
        })
        .on("end", function()
        {
          resolve(JSON.parse(body).output[0])
        })
      })
    }
  }
  return new Promise(requestMaker(input, hint))
  .then((result) =>
  {
    // console.log("Request Promise resolved.")
    return result.actions.say.text;
  })
}

AIMLProcessor.prototype.systemTag = function ( node )
{
  var attrPromise = this.getAttributeOrTagValue(node, "timeout");
  var promise = this.evalTagContent(node, "timeout");
  return Promise.all([promise, attrPromise]).then((results) => {
    var result = results[0],
      timeout = parseInt(results[1]);
    if (!timeout ||
      !Number.isInteger(timeout) ||
      timeout < 1 ||
      timeout > Config.MAX_SYSTEM_TIMEOUT)
    {
      timeout = Config.MAX_SYSTEM_TIMEOUT;
    }
    return new Promise((resolve, reject) => {
      const child_process = require('child_process');
      child_process.exec(result, {timeout:timeout}, (error, stdout, stderr) =>
        {
          if (error)
          {
            reject('Error in <system>'+error)
          }
          else
          {
            resolve(stdout.toString())
          }
        })
    }).catch((err) => {return "Sorry. I couldn't answer your question: " + err})
  })
}

// Since the AIML 2.0 spec doesn't even include this tag and the AIML 1.0.1
// does include it but doesn't require any particular behaviour, we're going
// to require the behaviour that a variable called "result" gets set and that's
// what get's put in the template
AIMLProcessor.prototype.jsTag = function ( node )
{
  var attrPromise = this.getAttributeOrTagValue(node, "timeout");
  var promise = this.evalTagContent(node, "timeout");
  return Promise.all([promise, attrPromise]).then((results) => {
    var script = results[0],
      timeout = parseInt(results[1]);
    if (!timeout ||
      !Number.isInteger(timeout) ||
      timeout < 1 ||
      timeout > Config.MAX_JS_TIMEOUT)
    {
      timeout = Config.MAX_JS_TIMEOUT;
    }
    const vm = require('vm');
    var sandbox = vm.createContext({result: ""}),
      script = vm.createScript(script);
    script.runInContext(sandbox, {timeout: timeout});
    return sandbox.result;
  }).catch((err) =>
    {
      if (err.message == "Script execution timed out.")
      {
        return "Sorry, your answer contained a script that was taking too long."
      }
      else
      {
        throw err;
      }
    }
  )
}

AIMLProcessor.prototype.sraix = function( node )
{
    var host = this.getAttributeOrTagValue( node, "host" ),
      botid  = this.getAttributeOrTagValue( node, "botid" ),
      hint   = this.getAttributeOrTagValue( node, "hint" ),
      limit  = this.getAttributeOrTagValue( node, "limit" ),
      service= this.getAttributeOrTagValue( node, "service" ),
      defaultResponse = this.getAttributeOrTagValue( node, "default" ),

      evalResult = this.evalTagContent( node, ["host", "botid" ]);

    return Promise.all([host, botid, hint, limit, service, defaultResponse, evalResult])
    .then((params) =>
    {
      var host = params[0],
          botid = params[1],
          hint = params[2],
          limit = params[3],
          service = params[4],
          defaultResponse = params[5],
          evalResult = params[6];
      if (!Config.ENABLE_NETWORK_CONNECTION) { throw new Error("sraix not allowed to access network") }
      else if (host && botid)
      {
        response = sraixPandorabots();
      }
      else if (service == "pannous")
      {
        response = sraixPannous(evalResult, hint);
      }
      return response;
    });
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
  else if (node.nodeName == "vocabulary") { return ValuePromise(this.bot.vocabulary.size) }
  else if (node.nodeName == "size") { return ValuePromise(this.bot.size) }
  else if (node.nodeName == "program") { return ValuePromise(Config.name + ' ' + Config.version) }
  else if (node.nodeName == "interval") { return this.interval(node) }
  else if (node.nodeName == "date") { return this.date(node) }
  else if (node.nodeName == "srai") { return this.srai(node) }
  else if (node.nodeName == "sr") { return this.srai(DOMParser.parseFromString("<srai>"+this.inputStars[0]+"</srai>").childNodes[0]) }
  else if (node.nodeName == "set") { return this.set(node) }
  else if (node.nodeName == "map") { return this.map(node) }
  else if (node.nodeName == "get") { return this.get(node) }
  else if (node.nodeName == "think") { return this.evalTagContent(node).then((res)=>{return""}); }
  else if (node.nodeName == "normalize") { return this.normalize(node) }
  else if (node.nodeName == "denormalize") { return this.denormalize(node) }
  else if (node.nodeName == "explode") { return this.explode(node) }
  else if (node.nodeName == "formal") { return this.formal(node) }
  else if (node.nodeName == "uppercase") { return this.uppercase(node) }
  else if (node.nodeName == "lowercase") { return this.lowercase(node) }
  else if (node.nodeName == "condition") { return this.loopCondition(node) }
  else if (node.nodeName == "learn") { return this.learn(node) }
  else if (node.nodeName == "first") { return this.first(node) }
  else if (node.nodeName == "rest")  { return this.rest(node) }
  else if (node.nodeName == "sraix") { return this.sraix(node) }
  else if (node.nodeName == "javascript" ) { return this.jsTag(node) }
  else if (node.nodeName == "system" ) { return this.systemTag(node) }
  else { return this.unevaluatedXML(node) }
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
