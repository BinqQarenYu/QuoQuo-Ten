import fs from 'fs';

let content = fs.readFileSync('src/lib/recipeData.ts', 'utf8');

const regex = /title: "(.*?)",/g;
let newContent = content.replace(regex, (match, title) => {
  let category = "Main Course";
  if (title.toLowerCase().includes("soup") || title.toLowerCase().includes("stew") || title === "Bulalo" || title === "Chicken Tinola" || title === "Pork Nilaga" || title === "Sinigang na Baboy" || title === "Sinampalukang Manok") {
    category = "Soup & Stew";
  } else if (title.toLowerCase().includes("pansit") || title.toLowerCase().includes("pancit") || title.toLowerCase().includes("noodle")) {
    category = "Noodles";
  } else if (title === "Champorado" || title === "Buko Pandan" || title.toLowerCase().includes("dessert")) {
    category = "Dessert";
  } else if (title === "Tapsilog" || title === "Tocino" || title === "Tortang Talong") {
    category = "Breakfast";
  } else if (title === "Chopsuey" || title === "Pinakbet" || title === "Ginisang Ampalaya" || title === "Adobong Sitaw" || title === "Laing" || title === "Ginisang Sayote" || title === "Ginataang Kalabasa at Sitaw" || title === "Ginisang Upo" || title === "Ginisang Toge") {
    category = "Vegetable";
  }
  return `title: "${title}",
    category: "${category}",`;
});

fs.writeFileSync('src/lib/recipeData.ts', newContent);
