// Go to channel info > Export chat > Select JSON, From the beginning, Size Limit to max > Export
// Place the element_dump.json file in the input folder and run this script to generate the element_data.json file in the output folder.

import { writeFileSync } from "fs";
import data from "./input/element_dump.json" with { type: "json" };
import path from "path";

const documents = data.messages
  .filter((m) => m.content?.body)
  .reduce((acc, m) => {
    acc[m.event_id] = m.content.body;
    return acc;
  }, {});

writeFileSync(
  path.resolve(import.meta.dirname, 'output', 'element_data.json'),
  JSON.stringify({
    metadata: {
      source: "element",
      name: data.room_name.trim()
    },
    documents
  }),
  { flag: "w" }
);