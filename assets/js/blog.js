/* Blog index: category filter built from the cards' data-category.
   The filter stays hidden until there are posts in two or more categories,
   so a one-post blog never shows a pointless filter. */
(function () {
  var bar = document.getElementById('blogFilter');
  var cards = Array.prototype.slice.call(document.querySelectorAll('.posts .post[data-category]'));
  if (!bar || !cards.length) return;

  var counts = {};
  cards.forEach(function (c) { var k = c.dataset.category; counts[k] = (counts[k] || 0) + 1; });
  var cats = Object.keys(counts);
  if (cats.length < 2) return;

  function button(label, value, n) {
    var b = document.createElement('button');
    b.type = 'button'; b.dataset.value = value;
    b.setAttribute('aria-pressed', value === 'all' ? 'true' : 'false');
    b.innerHTML = label + '<span>' + n + '</span>';
    return b;
  }
  bar.appendChild(button('All', 'all', cards.length));
  cats.forEach(function (k) { bar.appendChild(button(k, k, counts[k])); });
  bar.hidden = false;

  bar.addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    var v = b.dataset.value;
    bar.querySelectorAll('button').forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
    cards.forEach(function (c) { c.hidden = v !== 'all' && c.dataset.category !== v; });
  });
})();
