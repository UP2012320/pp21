const express = require('express');
const {sendImage} = require("./imager");

const PORT = 8080;
const app = express();

app.use(express.static('public'));

app.get('/img/:height/:width', async (req, res) => {
  let {width, height} = req.params;
  width = parseInt(width);
  height = parseInt(height);
  const squares = parseInt(req.query.square);
  const text = req.query.text;

  if (!width || !height) {
    res.sendStatus(400);
    return;
  }

  console.debug(width, height, squares, text);

  await sendImage(res, Number.parseInt(req.params.height), Number.parseInt(req.params.width));
})

app.listen(PORT, () => {
  console.debug(`Server running on port ${PORT}`);
});
