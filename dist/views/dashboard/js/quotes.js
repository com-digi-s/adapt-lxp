var quotes = ['Das Internet ist nur ein Hype — Bill Gates, 1997', 'Das Internet ist für uns alle Neuland — Angela Merkel, 2013', 'Im Internet finden Sie nur, was Sie suchen. Das aber verengt den Blickwinkel doch sehr — Frank A.Meyer', 'Ins Internet bin ich, glaube ich, einmal oder zweimal bisher gegangen — Hans-Christian Ströbele', 'In zehn Jahren ist Google tot — Christian DuMont Schütte, 2007', 'In zwei Jahren wird das Spam-Problem gelöst sein — Bill Gates, 2004', 'Digitalfotografie wird den Film nicht verdrängen — George M. Fisher, 1997 ', 'Es gibt keinen Grund, warum jeder einen Computer zu Hause haben sollte — Ken Olsen, 1977', 'Ich denke, dass es weltweit einen Markt für vielleicht fünf Computer gibt — Thomas Watson, 1943', 'Daten sind das Öl des 21. Jahrhunderts, und Datenanalyse der Verbrennungsmotor — Peter Sondergaard', 'Die Welt ist ein einziges Datenproblem — Andrew McAfee', 'Es gibt Daten ohne Information, aber keine Information ohne Daten — Daniel Keys Moran', 'Wir glauben an Gott. Alle anderen müssen Daten zeigen! — W. Edwards Deming'];

window.onload = function () {
  var randomIndex = Math.floor(Math.random() * quotes.length);
  var randomQuote = quotes[randomIndex];
  var quoteSplit = randomQuote.split(' — ');

  document.getElementById('quote_text').innerHTML = quoteSplit[0];
  document.getElementById('quote_author').innerHTML = quoteSplit[1];
};