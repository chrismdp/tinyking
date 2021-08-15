// These are needed as soon as we want to transpile down to default browsers
//import "core-js/stable";
import "regenerator-runtime/runtime";

import "./style.scss";

import React from "react";
import ReactDOM from "react-dom";
import ReactGA from "react-ga";
import { I18n } from "react-polyglot";
import { BrowserRouter as Router } from "react-router-dom";

import { World } from "components/world";
import messages from "data/messages.json";

import { library } from "@fortawesome/fontawesome-svg-core";
import { faDice, faUser, faShieldAlt, faRandom, faMountain } from "@fortawesome/free-solid-svg-icons";
import { faPlay, faPause, faFastForward } from "@fortawesome/free-solid-svg-icons";
import { faTimes } from "@fortawesome/free-solid-svg-icons";
library.add(faDice, faTimes, faPlay, faPause, faFastForward, faShieldAlt, faUser, faRandom, faMountain);

const locale = window.locale || "en";

ReactDOM.render(
  (<Router>
    <I18n locale={locale} messages={messages}>
      <World/>
    </I18n>
  </Router>),
  document.getElementById("root"));

if (process.env.NODE_ENV !== "production") {
  console.log("Tiny King: development mode!");
}

ReactGA.initialize("UA-431118-26", {debug: false});//process.env.NODE_ENV !== "production"});
