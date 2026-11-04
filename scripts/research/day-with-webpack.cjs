/* eslint-disable no-undef */
const path=require("node:path");
const root=path.resolve(__dirname,"../..");
module.exports={
  mode:"production",target:"node",entry:path.join(__dirname,"day-with-bundle.cjs"),
  output:{path:path.join(root,".cache/day-with"),filename:"play-bundle.cjs"},
  resolve:{alias:{game:path.join(root,"src/game"),data:path.join(root,"src/data"),render:path.join(root,"src/render"),[path.join(__dirname,"day-with-register.cjs")]:false}},
  module:{rules:[{test:/\.csv$/,loader:"csv-loader"}]},performance:{hints:false}
};
