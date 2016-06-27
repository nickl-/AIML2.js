function ChatSession() {
  this.predicates = new Map();
  this.thatHistory = [];
  this.inputHistory= [];
  this.requestHistory  = [];
  this.responseHistory = [];
}

module.exports = ChatSession;

if (require.main === module)
{
  console.log("Running ChatSession directly.");
}
