var Entry = {};
window.Entry = Entry;
Entry.Model = function() {
};
(function(a) {
  a.get = function(a) {
    return this[a];
  };
  a.set = function(a) {
    for (var b in a) {
      this[b] = a[b];
    }
  };
  a.observe = function() {
  };
  a.unobserve = function() {
  };
  a.notify = function() {
  };
})(Entry.Model.prototype);
Entry.ObserverModel = function() {
};
Entry.ObserverModel.prototype = Entry.Model.prototype;
(function(a) {
  a.set = function(a) {
    for (var b in a) {
      this[b] = a[b];
    }
    this.notify();
  };
  a.observe = function() {
  };
  a.unobserve = function() {
  };
  a.notify = function() {
  };
})(Entry.ObserverModel.prototype);

