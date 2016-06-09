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

module.exports = Path;
