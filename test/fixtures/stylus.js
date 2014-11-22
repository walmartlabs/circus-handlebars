require.css('./stylus.styl');
require.css('./css2.css');

if (!$serverSide) {
  require('./router1');
}
