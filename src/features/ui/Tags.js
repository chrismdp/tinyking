import React from "react";

export default function Tags({ tags }) {
  return <ul className="flex py-2 text-xs">
    { tags.map(tag => <li key={tag} className='mx-1 bg-gray-700 py-1 px-2 rounded'>{tag}</li>) }
  </ul>
}

