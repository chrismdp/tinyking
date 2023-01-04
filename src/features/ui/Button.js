import React from "react";

export default function Button({ children, secondary, ...props }) {
  const colours = secondary ?
    "hover:bg-grey-800 bg-grey-900" :
    "hover:bg-blue-800 bg-blue-900";
  return <button className={`px-4 py-2 ${colours} mr-2 rounded-lg`} {...props}>
    {children}
  </button>;
}
