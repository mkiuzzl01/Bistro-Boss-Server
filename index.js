const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const stripe = require("stripe")(process.env.PAYMENT_SECRET);
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const app = express();
const port = process.env.PORT || 5000;

// middleware
app.use(cors());
app.use(express.json());

//Token Verify
const verifyToken = (req, res, next) => {
  // console.log(req.headers.authorization);
  if (!req.headers.authorization) {
    return res.status(401).send({ message: "unauthorize access" });
  }
  const token = req.headers.authorization.split(" ")[1];
  jwt.verify(token, process.env.ACCESS_TOKEN, (err, decoded) => {
    if (err) {
      return res.status(401).send({ message: "unauthorize access" });
    }
    req.decoded = decoded;
    next();
  });
};

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.rbychrh.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // await client.connect();
    const menuCollection = client.db("Bistro-Boss").collection("Menu");
    const reviewCollection = client.db("Bistro-Boss").collection("Reviews");
    const addCardCollection = client.db("Bistro-Boss").collection("addCarts");
    const userCollection = client.db("Bistro-Boss").collection("Users");
    const paymentsCollection = client.db("Bistro-Boss").collection("Payments");

    //Token Generate
    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN, {
        expiresIn: "1h",
      });
      res.send({ token });
    });
    //use Verify Admin
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded?.email;
      const query = { email: email };
      const result = await userCollection.findOne(query);
      const isAmin = result?.Role === "Admin";
      if (!isAmin) {
        return res.status(403).send({ message: "forbidden access" });
      }
      next();
    };

    //user Related API
    app.get("/users", verifyToken, verifyAdmin, async (req, res) => {
      const result = await userCollection.find().toArray();
      res.send(result);
    });

    //Check Admin
    app.get("/users/Admin/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      if (email !== req.decoded.email) {
        return res.status(403).send({ massage: "forbidden access" });
      }
      const query = { email: email };
      const result = await userCollection.findOne(query);
      let admin = false;
      if (result) {
        admin = result?.Role === "Admin";
      }
      res.send({ admin });
    });

    app.post("/users", async (req, res) => {
      const info = req.body;
      const query = { email: info.email };
      const existingUser = await userCollection.findOne(query);
      if (existingUser) {
        return res.send({ message: "User Already Exits", insertedId: null });
      }
      const result = await userCollection.insertOne(info);
      res.send(result);
    });

    app.patch(
      "/users/Admin/:id",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        const id = req.params.id;
        const filter = { _id: new ObjectId(id) };
        const updatedDoc = {
          $set: { Role: "Admin" },
        };
        const result = await userCollection.updateOne(filter, updatedDoc);
        res.send(result);
      }
    );

    app.delete("/Delete/:id", verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await userCollection.deleteOne(query);
      res.send(result);
    });

    //food related API
    app.get("/menu", async (req, res) => {
      const result = await menuCollection.find().toArray();
      res.send(result);
    });

    app.get("/menu/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const result = await menuCollection.findOne(filter);
      res.send(result);
    });

    app.patch("/menu/:id", async (req, res) => {
      const id = req.params.id;
      const item = req.body;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: { ...item },
      };
      const result = await menuCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });

    app.post("/menu", verifyToken, verifyAdmin, async (req, res) => {
      const food = req.body;
      const query = { ...food };
      const result = await menuCollection.insertOne(query);
      res.send(result);
    });

    app.delete("/menu/:id", verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await menuCollection.deleteOne(query);
      res.send(result);
    });

    //Cart Related Api
    app.get("/carts", async (req, res) => {
      const email = req.query.email;
      let query = {};
      if (email) {
        query = { email };
      }
      const result = await addCardCollection.find(query).toArray();
      res.send(result);
    });

    app.post("/carts", async (req, res) => {
      const item = req.body;
      const result = await addCardCollection.insertOne(item);
      res.send(result);
    });

    app.delete("/item-delete/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      console.log("id", id);
      const query = { _id: new ObjectId(id) };
      const result = await addCardCollection.deleteOne(query);
      res.send(result);
    });

    //Payment Related API
    app.post("/create-payment-intent", async (req, res) => {
      const { totalPrice } = req.body;
      const amount = parseInt(totalPrice * 100);
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"],
      });
      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });

    app.post("/payments", async (req, res) => {
      const info = req.body;
      const result = await paymentsCollection.insertOne(info);
      const query = {
        _id: {
          $in: info.cardIds.map((id) => new ObjectId(id)),
        },
      };
      const deleteResult = await addCardCollection.deleteMany(query);
      res.send({ result, deleteResult });
    });

    app.get("/payments-history/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      if (email !== req.decoded.email)
        return res.status(403).send({ message: "forbidden access" });
      const query = { email };
      const result = await paymentsCollection.find(query).toArray();
      res.send(result);
    });

    //Admin analytics
    app.get('/admin-stats', verifyToken,verifyAdmin,async(req,res)=>{
      const users = await userCollection.estimatedDocumentCount();
      const menus = await menuCollection.estimatedDocumentCount();
      const payments = await paymentsCollection.estimatedDocumentCount();
      const result = await paymentsCollection.aggregate([
        {
          $group:{
            _id:null,
            totalRevenue:{
             $sum:'$price'
            }
          }
        }
      ]).toArray();
      const revenue = result.length > 0 ? result [0].totalRevenue:0;

      res.send({users,menus,payments,revenue});
    })

    //using aggregate pipeline
    app.get('/order-stats', verifyToken,verifyAdmin, async (req,res)=>{
      const result = await paymentsCollection.aggregate([
        //convert id to objectID because only id cannot find,then unwind.  
        {
          $project: {
            menuIds: {
              $map: {
                input: "$menuIds",
                as: "id",
                in: { $convert: { input: "$$id", to: "objectId", onError: "$$id", onNull: "$$id" } }
              }
            }
          }
        },
        {
          $unwind:'$menuIds'
        },
        {
          $lookup:{
            from:'Menu',
            localField:'menuIds',
            foreignField:'_id',
            as:'menuItems'
          }
        },
        {
          $unwind:'$menuItems'
        },
        {
          $group:{
            _id:'$menuItems.category',
            quantity:{$sum: 1},
            revenue:{$sum:'$menuItems.price'}
          }
        },
        {
          $project:{
            _id:0,
            category:'$_id',
            quantity:'$quantity',
            revenue:'$revenue',
          }
        }
      ]).toArray();
      res.send(result);
    })

    // await client.db("admin").command({ ping: 1 });
    // console.log(
    //   "Pinged your deployment. You successfully connected to MongoDB!"
    // );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", async (req, res) => {
  res.send(`Bistro-Boss is running`);
});
app.listen(port, () => {
  console.log(`Bistro-Boss is running on:${port}`);
});
