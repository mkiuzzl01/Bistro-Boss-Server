const express = require('express');
const cors = require('cors');
// const jwt = require('jsonwebtoken');
require('dotenv').config()
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const app = express();
const port = process.env.PORT || 5000;

// middleware
app.use(cors());
app.use(express.json());


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.rbychrh.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
      await client.connect();
    const menuCollection = client.db('Bistro-Boss').collection('Menu');
    const reviewCollection = client.db('Bistro-Boss').collection('Reviews');
    const addCardCollection = client.db('Bistro-Boss').collection('addCarts');
    const userCollection = client.db('Bistro-Boss').collection('Users');
    // Send a ping to confirm a successful connection

    //user Related API
    app.get('/users', async (req,res)=>{
      const result = await userCollection.find().toArray();
      res.send(result);
    })

    app.post('/users',async(req,res)=>{
      const info = req.body;
      const query = {email:info.email};
      const existingUser = await userCollection.findOne(query);
      if(existingUser){
        return res.send({message:"User Already Exits",insertedId:null});
      }
      const result = await userCollection.insertOne(info);
      res.send(result);
    })
    
    app.patch('/users/Admin/:id',async(req,res)=>{
      const id = req.params.id;
      const filter = {_id:new ObjectId(id)};
      const updatedDoc = {
        $set:{Role:"Admin"}
      }
      const result = await userCollection.updateOne(filter,updatedDoc);
      res.send(result);
    })

    app.delete('/Delete/:id', async (req,res)=>{
      const id = req.params.id;
      const query = {_id: new ObjectId(id)};
      const result = await userCollection.deleteOne(query);
      res.send(result);
    })

    //food related API
    app.get('/menu', async (req,res)=>{
        const result = await menuCollection.find().toArray();
        res.send(result);
    })

    app.get('/carts', async (req,res)=>{
      const email = req.query.email;
      let query = {};
      if(email){
        query = {email}
      }
      const result = await addCardCollection.find(query).toArray();
      res.send(result);
    })
    
    app.post('/carts', async(req,res)=>{
      const item = req.body;
      console.log(item);
      const result = await addCardCollection.insertOne(item);
      res.send(result);
    })
    app.delete('/Delete/:id',async(req,res)=>{
      const id = req.params.id;
      const query = {_id: new ObjectId(id)};
      const result = await addCardCollection.deleteOne(query);
      res.send(result);
    })


    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get('/', async (req,res)=>{
    res.send(`Bistro-Boss is running`)
})
app.listen(port,()=>{
    console.log(`Bistro-Boss is running on:${port}`);
})
