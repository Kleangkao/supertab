(function () {
  var key = "supertab.shopping-session.v1";
  try {
    var saved = localStorage.getItem(key);
    if (saved && !sessionStorage.getItem(key)) sessionStorage.setItem(key, saved);
    var rawSet = sessionStorage.setItem.bind(sessionStorage);
    sessionStorage.setItem = function (name, value) {
      rawSet(name, value);
      if (name === key) localStorage.setItem(name, value);
    };
    var rawRemove = sessionStorage.removeItem.bind(sessionStorage);
    sessionStorage.removeItem = function (name) {
      rawRemove(name);
      if (name === key) localStorage.removeItem(name);
    };
  } catch (error) {}
})();
