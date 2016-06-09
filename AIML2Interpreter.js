DomJS = require("dom-js").DomJS;
fs = require('fs');

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

//botAttributes contain things like name, age, master, gender...
var AIMLInterpreter = function(botAttributesParam){
    var self = this;
    botAttributes = botAttributesParam;

    this.loadAIMLFilesIntoArray = function(inFileArray){
        fileArray = inFileArray;
        isAIMLFileLoadingStarted = true;
        var fileIndex = 0;
        var readAIMLFile = function(file){
            fs.readFile(file, 'utf8', function (err,data) {
                if (err) {
                    return console.log(err);
                }

                fileIndex++;

                new DomJS().parse(data, function(err, dom) {
                    var topCategories, topics;
                    if (err) {
                        //            return cb(err);
                    }
                    if (dom.name === !'aiml') {
                        //            return cb('Unsupported file');
                    }
                    domArray[domIndex] = dom;
                    domIndex++;
                    if(fileIndex < fileArray.length){
                        readAIMLFile(fileArray[fileIndex]);
                    }
                    else{
                        console.log('AIML file is loaded!');
                        isAIMLFileLoaded = true;
                    }
                });
            });
        }
        readAIMLFile(fileArray[fileIndex]);
    };

    this.findAnswerInLoadedAIMLFiles = function(clientInput, cb){
        //check if all AIML files have been loaded. If not, call this method again after a delay
        if(isAIMLFileLoaded){
            clientInput = clientInput.toUpperCase();

            wildCardArray = [];
            var result = '';
            for(var i = 0; i < domArray.length; i++){
                cleanDom(domArray[i].children);
                console.log("Searching ", fileArray[i]);
                result = findCorrectCategory(clientInput, domArray[i].children);
                if(result){
                    break;
                }
            }

            if(result){
                result = cleanStringFormatCharacters(result);
                previousAnswer = result;
            }
            cb(result, wildCardArray, clientInput);
        }
        else{
            var findAnswerInLoadedAIMLFilesWrapper = function(clientInput, cb){
                return function(){
                    self.findAnswerInLoadedAIMLFiles(clientInput, cb);
                };
            };

            setTimeout(findAnswerInLoadedAIMLFilesWrapper(clientInput, cb), 1000);
        }
    };
    //restart the DOM in order to load a new AIML File
    this.restartDom = function(){
      domArray=[];
      domIndex=0;
      fileArray = [];

      isAIMLFileLoadingStarted = false;
      isAIMLFileLoaded = false;
    }
};

// remove string control characters (like line-breaks '\r\n', leading / trailing spaces etc.)
var cleanStringFormatCharacters = function(str){
    var cleanedStr = str.replace(/\r\n/gi, '');
    cleanedStr = cleanedStr.replace(/^\s*/, '');
    cleanedStr = cleanedStr.replace(/\s*$/,'');

    return cleanedStr;
}

var cleanDom = function(childNodes){
    for(var i = 0; i < childNodes.length; i++){
        if(childNodes[i].hasOwnProperty('text') & typeof(childNodes[i].text) === 'string'){

            // remove all nodes of type 'text' when they just contain '\r\n'. This indicates line break in the AIML file
            if(childNodes[i].text.match(/^\s*\r\n\s*$/gi)){
                childNodes.splice(i, 1);
            }
        }
    }


    // traverse through whole tree by recursive calls
    for(var j = 0; j < childNodes.length; j++){
        if(childNodes[j].hasOwnProperty('children')){
            cleanDom(childNodes[j].children);
        }
    }
};

var findCorrectCategory = function(clientInput, domCategories){
    //indexOfSetTagAmountWithWildCard indicates how many sets with wildcard occur so that those sets store the correct wildcard value
    var indexOfSetTagAmountWithWildCard = 0;

    var  travereseThroughDomToFindMatchingPattern= function(categories, depth){
        if (!depth)
        {
          depth = 0;
        }
        for(var i = 0; i < categories.length; i++){
            if(categories[i].name === 'category'){
                //traverse through the dom
                //text gets the value of the current pattern node
                var text = travereseThroughDomToFindMatchingPattern(categories[i].children, depth+1);
                //check if the input of the user matches the pattern text
                var matches = checkIfMessageMatchesPattern(clientInput, text);
                if(matches){
                    //check if a 'that' tag is existing. If yes, check if the text of the that tag matches the previous given answer.
                    //If it does not match, continue the traversion through the AIML file
                    var isMatchingThat = checkForThatMatching(categories[i].children);
                    if(isMatchingThat){
                        var text = findFinalTextInTemplateNode(categories[i].children);
                        if(text){
                            return text;
                        }
                        break;
                    }
                }
            }
            else if(categories[i].name === 'pattern'){
                var text = resolveChildNodesInPatternNode(categories[i].children);
                return text;
            }
        }
    }

    var checkForThatMatching = function(categoryChildNodes){
        for(var i = 0; i < categoryChildNodes.length; i++){
            if(categoryChildNodes[i].name === 'that'){
                //if the previous answer of the bot does not match the that-tag text, then return undefined!
                if(categoryChildNodes[i].children[0].text != previousAnswer){
                    return false;
                }
                else{
                    return true;
                }
            }
        }
        //if no that tag was found, everything 'fits'
        return true;
    }

    var resolveChildNodesInPatternNode = function(patternChildNodes){
        var text = '';

        for(var i = 0; i < patternChildNodes.length; i++){
            if(patternChildNodes[i].name === 'bot'){
                text = text + botAttributes[patternChildNodes[i].attributes.name];
            }
            else if(patternChildNodes[i].name === 'get'){
                text = text + storedVariableValues[patternChildNodes[i].attributes.name];
            }
            else if(patternChildNodes[i].name === 'set'){
                text = text + patternChildNodes[i].children[0].text;
            }
            else{
                text = text + patternChildNodes[i].text;
            }
        }

        return text;
    }

    var findFinalTextInTemplateNode = function(childNodesOfTemplate){
        var text = '';

        //traverse through template nodes until final text is found
        //return it then to very beginning
        for(var i = 0; i < childNodesOfTemplate.length; i++){
            if(childNodesOfTemplate[i].name === 'template'){
                //traverse as long through the dom until final text was found
                //final text -> text after special nodes (bot, get, set,...) were resolved
                return findFinalTextInTemplateNode(childNodesOfTemplate[i].children);
            }
            else if(childNodesOfTemplate[i].name === 'condition'){
                return resolveSpecialNodes(childNodesOfTemplate);
            }
            else if(childNodesOfTemplate[i].name === 'random'){
                //if random node was found, it's children are 'li' nodes.
                //pick one li node by random and continue dom traversion until final text is found
                var randomNumber = Math.floor(Math.random() * (childNodesOfTemplate[i].children.length));
                return findFinalTextInTemplateNode([childNodesOfTemplate[i].children[randomNumber]]);
            }
            else if(childNodesOfTemplate[i].name === 'srai'){
                //take pattern text of srai node to get answer of another category
                var sraiText = '' + findFinalTextInTemplateNode(childNodesOfTemplate[i].children);
                sraiText = sraiText.toUpperCase();
                var referredPatternText = sraiText;
                //call findCorrectCategory again to find the category that belongs to the srai node
                //console.log("SRAI called on ", sraiText);
                var text;
                for(var i = 0; i < domArray.length; i++){
                    cleanDom(domArray[i].children);
                    console.log("Searching ", fileArray[i]);
                    text = findCorrectCategory(sraiText, domArray[i].children);
                    if(text){
                        break;
                    }
                }
                return text;
            }
            else if(childNodesOfTemplate[i].name === 'li'){
                return findFinalTextInTemplateNode(childNodesOfTemplate[i].children);
            }
            else if(childNodesOfTemplate[i].name === 'pattern'){
                //(here it is already checked that this is the right pattern that matches the user input)
                //make use of the functions of the special nodes - bot, set, get...
                resolveSpecialNodes(childNodesOfTemplate[i].children);
                continue;
            }
            else if(childNodesOfTemplate[i].name === 'bot'){
                text = resolveSpecialNodes(childNodesOfTemplate);
                return text;
            }
            else if(childNodesOfTemplate[i].name === 'set'){
                text = resolveSpecialNodes(childNodesOfTemplate);
                return text;
            }
            else if(childNodesOfTemplate[i].name === 'get'){
                text = resolveSpecialNodes(childNodesOfTemplate);
                return text;
            }
            else if(childNodesOfTemplate[i].name === 'sr'){
                text = resolveSpecialNodes(childNodesOfTemplate);
                return text;
            }
            else if(childNodesOfTemplate[i].name === 'star'){
                text = resolveSpecialNodes(childNodesOfTemplate);
                return text;
            }
            else if(childNodesOfTemplate[i].name === 'that'){

            }
            else{
                //this is the text of template node
                //after all special functions (bot, get, set,...) were resolved
                //return that text
                text = resolveSpecialNodes(childNodesOfTemplate);
                if((text.match('[\\n|\\t]*[^A-Z|^a-z|^!|^?]*')[0] === '') && (text.indexOf('function ()') === -1)){
                    return (text);
                }
            }
        }
    };

    var resolveSpecialNodes = function(innerNodes){
        var text = '';
        //concatenate string of all node children - normal text, bot tags, get tags, set tags...
        for(var i = 0; i < innerNodes.length; i++){

            if(innerNodes[i].name === 'bot'){
                //replace bot tags by the belonging bot attribute value
                text = text + botAttributes[innerNodes[i].attributes.name];
            }
            else if(innerNodes[i].name === 'get'){
                //replace get tag by belonging variable value
                text = text + storedVariableValues[innerNodes[i].attributes.name];
            }
            else if(innerNodes[i].name === 'set'){
                //store value of set tag text into variable (variable name = attribute of set tag)
                //replace than set tag by the text value

                if(innerNodes[i].children[0].text === '*'){
                    //the first set-Tag with wildCard gets the first wildCardValue, the second set-Tag with wildCard gets the second wildCardValue etc.
                    storedVariableValues[innerNodes[i].attributes.name] = wildCardArray[indexOfSetTagAmountWithWildCard];
                    indexOfSetTagAmountWithWildCard++;
                }else{
                    storedVariableValues[innerNodes[i].attributes.name] = innerNodes[i].children[0].text;
                }
//                text = text + innerNodes[i].children[0].text;
                text = text + resolveSpecialNodes(innerNodes[i].children);
            }
            else if(innerNodes[i].name === 'sr'){
                var result;

                //for-loop to go through all loaded AIML files
                for(var j = 0; j < domArray.length; j++){
                    result = findCorrectCategory(lastWildCardValue, domArray[j].children);
                    //if in one of the dom trees a matching pattern was found, exit this inner loop
                    if(result){
                        text = text + result;
                        break;
                    }
                }
            }
            else if(innerNodes[i].name === 'star'){
              if(innerNodes[i].attributes.index !== undefined){
                var star_ind = innerNodes[i].attributes.index-1;
                if (star_ind < wildCardArray.length) {
                  text = text + wildCardArray[star_ind];
                } else {
                  console.log("Asked for non-existant star index "+ star_ind)
                }
              }else{
                text = text + wildCardArray[0];
              }
            }
            else if(innerNodes[i].name === 'condition') {
                // condition tag specification: list condition tag
                if(innerNodes[i].attributes.name === undefined){
                    if(innerNodes[i].children === undefined){
                        return undefined;
                    }
                    var child;
                    for(var c in innerNodes[i].children){
                        child = innerNodes[i].children[c];
                        if(child.name === 'li'){
                            if(child.attributes.value == undefined
                                || storedVariableValues[child.attributes.name] === child.attributes.value.toUpperCase()){
                                return findFinalTextInTemplateNode(child.children);
                            }
                        }
                    }
                }
                // condition tag specification: multi condition tag
                else if(innerNodes[i].attributes.value !== undefined){
                    if (storedVariableValues[innerNodes[i].attributes.name] === innerNodes[i].attributes.value.toUpperCase()) {
                        text = text + resolveSpecialNodes(innerNodes[i].children);
                    }
                }
                // condition tag specification: single name list condition tags
                else if(innerNodes[i].children !== undefined){
                    var child;
                    for(var c in innerNodes[i].children){
                        child = innerNodes[i].children[c];
                        if(child.name === 'li'){
                            if(child.attributes.value === undefined
                                || storedVariableValues[innerNodes[i].attributes.name] === child.attributes.value.toUpperCase()){
                                return findFinalTextInTemplateNode(child.children);
                            }
                        }
                    }

                    return undefined;
                }
            }
            else{
                //normal text (no special tag)
                text = text + innerNodes[i].text;
            }
        }

        text = cleanStringFormatCharacters(text);
        return text;
    }

    return travereseThroughDomToFindMatchingPattern(domCategories);
}

var checkIfMessageMatchesPattern = function(userInput, patternText){
    //convert wildcards in of the pattern node into a regex that matches every char
    var regexPattern = convertWildcardToRegex(patternText);

    //match userInput with the regex pattern
    //if it matches, matchedString is defined
    var matchedString = userInput.match(regexPattern);

    if(matchedString){

      // if (!patternText.match(/^[\*_]$/))
      // {
        console.log("Matched ", userInput, " on ", patternText, ' -> ', regexPattern);
      // }

      for (var i = 0; i < matchedString.length - 1; i++) {

        wildCardArray[i] = matchedString[i+1];

      }
      return true;
    }
    else{
      return false;
    }
  }

var convertWildcardToRegex = function(text){

  // also, there's all these weird question marks that I don't think are standard syntax?
  modifiedText = text.replace(/\?/g, '\\?');

      //replace wildcard (*) by regex
    modifiedText = modifiedText.replace(/[\*_]/g, '([A-Z0-9]+[A-Z0-9\\-\\s]*[A-Z0-9]*[\\!\\.\\?]?)');



    return new RegExp('^' + modifiedText + '$');
}

var getWildCardValue = function(userInput, patternText){
    //get all strings of the pattern that are divided by a *
    //e.g. WHAT IS THE RELATION BETWEEN * AND * -> [WHAT IS THE RELATION BETWEEN , AND ]
    var replaceArray = patternText.split('*');
    var wildCardInput = userInput;

    if(replaceArray.length > 1){
        //replace the string of the userInput which is fixed by the pattern
        for(var i = 0; i < replaceArray.length; i++){
            wildCardInput = wildCardInput.replace(replaceArray[i], '|');
        }
        //split the wildCardInput string by | to differentiate multiple * inputs
        //e.g. userInput = WHAT IS THE RELATION BETWEEN TIM AND STRUPPI?
        //-> | TIM | STRUPPI
        //-> [TIM, STRUPPI]
        wildCardInput = wildCardInput.split('|');
        //split function can create an array which also includes spaces etc. -> e.g. [TIM, " ", "", STRUPPI, " "]
        //we just want the information
        var wildCardArrayIndex = 0;
        for(var i = 0; i < wildCardInput.length; i++){
            if(wildCardInput[i] != '' && wildCardInput[i] != ' ' && wildCardInput != undefined){
                var wildCard = wildCardInput[i];
                var wildCardLastCharIndex = wildCard.length - 1;
                var firstCharOfWildCard = wildCard.charAt(0);
                var lastCharOfWildCard = wildCard.charAt(wildCardLastCharIndex);

                try{
                    //harmonize the wildcard string
                    //remove first char if it is a space.
                    //calculate the last index again since the length of the string changed
                    if(firstCharOfWildCard === ' '){
                        wildCard = wildCard.splice(0);
                        wildCardLastCharIndex = wildCard.length - 1;
                        lastCharOfWildCard = wildCard.charAt(wildCardLastCharIndex);
                    }
                    //if the last char is a space, remove it
                    //calculate the last index again since the length of the string changed
                    if(lastCharOfWildCard === ' '){
                        wildCard = wildCard.substr(0, wildCardLastCharIndex);
                        wildCardLastCharIndex = wildCard.length - 1;
                        lastCharOfWildCard = wildCard.charAt(wildCardLastCharIndex);
                    }
                    if(lastCharOfWildCard === '?'){
                        wildCard = wildCard.substr(0, wildCardLastCharIndex);
                    }
                }
                catch(e){

                }
                wildCardArray[wildCardArrayIndex] = wildCard;
                wildCardArrayIndex++;
            }
        }
    }
    if(wildCardArray.length - 1 >= 0){
        lastWildCardValue = wildCardArray[wildCardArray.length - 1];
    }

    return wildCardArray;
}

module.exports = AIMLInterpreter;
