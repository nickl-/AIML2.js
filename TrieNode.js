function TrieNode() {
  this.key = '';
  this.value = undefined;
  this.height = Number.MAX_SAFE_INTEGER;
  this.map = undefined;

}

TrieNode.prototype.size = function() {
  var s = this.map.size();
  if (key && key != "")
  {
    s = s + 1;
  }
  return s;
}

TrieNode.prototype.contains = function (word) {
  if (this.map)
  {
    return this.map.has(word);
  }
  return (word == this.key);
}


TrieNode.prototype.get = function (key) {
  if (this.map)
  {
    return this.map.get(key);
  }
  else
  {
    if (this.key == key)
    {
      return this.value;
    }
  }
  return undefined;
}

TrieNode.prototype.put = function (key, value) {
  if (this.map)
  {
    this.map.set(key, value);
  }
  else
  {
    this.key = key;
    this.value = value;
  }
}

TrieNode.prototype.printKeys = function () {
  if (this.map)
  {
    this.map.keys().forEach(function(k) { console.log(k) });
  }
}

TrieNode.prototype.upgrade = function () {
  this.map = new Map();
  this.map.set(this.key, this.value);
  this.key = '';
  this.value = undefined;
}

TrieNode.prototype.addPath = function(path, category) {
  if (!path)
  {
    this.category = category;
    this.height = 0;
  }
  else if (this.contains(path.word))
  {
    var next = this.get(path.word);
    next.addPath(path.next, category);
    var offset = 1;
    if (path.word == '#' || path.word == '^')
    {
      offset = 0
    }
    this.height = Math.min(next.height + offset, this.height);
  }
  else
  {
      var next = new TrieNode();
      if (this.key)
      {
        this.upgrade();
      }
      this.put(path.word, next);
      next.addPath(path.next, category);
      var offset = 1;
      if (path.word == '#' || path.word == '^')
      {
        offset = 0;
      }
      this.height = Math.min(next.height + offset, this.height);
  }
}

TrieNode.prototype.findNode = function(path) {
  if (!path)
  {
    return this;
  }
  else if (this.contains(path.word))
  {
    var next = this.get(path.word)
    return next.findNode(path.next);
  }
  else
  {
    return undefined;
  }
}

TrieNode.prototype.isLeaf = function () {
  return this.category != undfined;
}
module.exports = TrieNode;
