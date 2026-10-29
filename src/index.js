// These are needed as soon as we want to transpile down to default browsers
//import "core-js/stable";
import "regenerator-runtime/runtime";

import "./style.scss";

import React from "react";
import { createRoot } from "react-dom/client";
import { I18n } from "react-polyglot";
import { BrowserRouter as Router } from "react-router-dom";

import { World } from "components/world";
import messages from "data/messages.json";

import { library } from "@fortawesome/fontawesome-svg-core";
import { faDice, faUser, faShieldAlt, faRandom, faMountain } from "@fortawesome/free-solid-svg-icons";
import { faPlay, faPause, faFastForward } from "@fortawesome/free-solid-svg-icons";
import { faCaretLeft, faCaretRight } from "@fortawesome/free-solid-svg-icons";
import { faTimes } from "@fortawesome/free-solid-svg-icons";
library.add(faDice, faTimes, faPlay, faPause, faFastForward, faShieldAlt, faUser, faRandom, faMountain, faCaretLeft, faCaretRight);

const locale = window.locale || "en";

createRoot(document.getElementById("root")).render(
  (<Router>
    <I18n locale={locale} messages={messages}>
      <World/>
    </I18n>
  </Router>));

if (process.env.NODE_ENV !== "production") {
  console.log("Tiny King: development mode!");
}

