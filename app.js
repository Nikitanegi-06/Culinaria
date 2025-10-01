require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const methodOverride = require('method-override');
const path = require('path');
const Recipe = require('./models/recipe');

const app = express();

// ✅ Connect MongoDB Atlas
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
  .then(() => console.log("MongoDB Connected"))
  .catch(err => console.error("MongoDB Error:", err));

// ✅ Middleware setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.urlencoded({ extended: true }));
app.use(methodOverride('_method'));
app.use(express.static(path.join(__dirname, 'public')));

// ✅ Home route
app.get('/', async (req, res) => {
  try {
    const recipes = await Recipe.find();
    res.render('home', { recipes });
  } catch (err) {
    console.error(err);
    res.status(500).send("Error fetching recipes");
  }
});

// ✅ Add new recipe form
app.get('/recipes/new', (req, res) => {
  res.render('add');
});

app.post('/recipes', async (req, res) => {
  try {
    const { name, ingredients, steps, image } = req.body;
    const newRecipe = new Recipe({
      name,
      ingredients: ingredients.split(',').map(item => item.trim()),
      steps,
      image
    });

    await newRecipe.save();
    res.redirect('/myrecipes');
  } catch (err) {
    console.error(err);
    res.status(500).send("Error saving recipe");
  }
});

// ✅ Edit recipe
app.get('/recipes/:id/edit', async (req, res) => {
  const { id } = req.params;
  const recipe = await Recipe.findById(id);
  res.render('edit', { recipe });
});

// ✅ Update recipe
app.put('/recipes/:id', async (req, res) => {
  const { id } = req.params;
  await Recipe.findByIdAndUpdate(id, req.body);
  res.redirect('/myrecipes');
});

// ✅ Delete recipe
app.delete('/recipes/:id', async (req, res) => {
  const { id } = req.params;
  await Recipe.findByIdAndDelete(id);
  res.redirect('/myrecipes');
});

// ✅ My Recipes route
app.get("/myrecipes", async (req, res) => {
  try {
    const recipes = await Recipe.find();
    res.render("myRecipes", { recipes });
  } catch (err) {
    res.status(500).send("Error fetching recipes");
  }
});

// ✅ Unified Search (Meals + Drinks)
app.get('/search', async (req, res) => {
  const query = req.query.q;
  if (!query) return res.render('search', { results: [] });

  try {
    const mealRes = await fetch(`https://www.themealdb.com/api/json/v1/1/search.php?s=${query}`);
    const mealData = await mealRes.json();

    const drinkRes = await fetch(`https://www.thecocktaildb.com/api/json/v1/1/search.php?s=${query}`);
    const drinkData = await drinkRes.json();

    const mealResults = (mealData.meals || []).map(m => ({
      id: m.idMeal,
      name: m.strMeal,
      image: m.strMealThumb,
      category: m.strCategory,
      type: 'meal'
    }));

    const drinkResults = (drinkData.drinks || []).map(d => ({
      id: d.idDrink,
      name: d.strDrink,
      image: d.strDrinkThumb,
      category: d.strCategory,
      type: 'drink'
    }));

    const combined = [...mealResults, ...drinkResults];
    res.render('search', { results: combined });
  } catch (err) {
    console.error(err);
    res.render('search', { results: [] });
  }
});

// ✅ Recipe Details Page
app.get('/recipe/:type/:id', async (req, res) => {
  const { type, id } = req.params;

  try {
    if (type === 'meal') {
      const response = await fetch(`https://www.themealdb.com/api/json/v1/1/lookup.php?i=${id}`);
      const data = await response.json();
      const meal = data.meals ? data.meals[0] : null;
      return res.render('recipe', { recipe: meal, type: 'meal' });
    } else {
      const response = await fetch(`https://www.thecocktaildb.com/api/json/v1/1/lookup.php?i=${id}`);
      const data = await response.json();
      const drink = data.drinks ? data.drinks[0] : null;
      return res.render('recipe', { recipe: drink, type: 'drink' });
    }
  } catch (err) {
    console.error(err);
    res.render('recipe', { recipe: null, type });
  }
});

// ✅ API Endpoint for Meal Category (Spoonacular)
app.get('/api/meal', async (req, res) => {
  const category = req.query.q;
  try {
    const response = await fetch(
      `https://api.spoonacular.com/recipes/complexSearch?type=${category}&number=8&apiKey=${process.env.SPOONACULAR_API_KEY}`
    );
    const data = await response.json();
    res.json(data.results);
  } catch (err) {
    console.error(err);
    res.json([]);
  }
});

// ✅ Export app for Vercel
module.exports = app;
