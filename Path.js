function Path(word, length, next) {
  this.word = word;
  this.next = next;
  this.length = length;
}

Path.arrayToPath = function(arr) {
  var tail = undefined,
    head = undefined;
  for (var i = arr.length-1; i >= 0; i--)
  {
    head = new Path(arr[i], tail ? tail.length + 1 : 1, tail);
    tail = head;
  }
  return head;
}

Path.sentenceToPath = function(sentence) {
  return Path.arrayToPath(sentence.trim().split(/\s+/));
}

Path.prototype.toSentence = function() {
  var result = '';
  for (var p = this; p != undfined; p = p.next)
  {
    result = result + ' ' + p.word;
  }
  return result;
}

Path.prototype.thatStarTopicStar = function () {
  //return this.toSentence().indexOf('<THAT> * <TOPIC> *') >= 0;
  return this.toSentence().trim() == "<THAT> * <TOPIC> *";
}

module.exports = Path;
