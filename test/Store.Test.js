const {
  time,
  loadFixture,
  mine,
} = require("@nomicfoundation/hardhat-network-helpers");
const { expect } = require("chai");

const Events = {
  ProductAdded: "ProductAdded",
  ProductUpdated: "ProductUpdated",
  ProductBought: "ProductBought",
  ProductRefund: "ProductRefund",
};

describe("Store", function () {
  async function provideStore() {
    // Contracts are deployed using the first signer/account by default.
    const [owner, buyer, buyer2, buyer3] = await ethers.getSigners();

    const Store = await ethers.getContractFactory("Store");
    const store = await Store.deploy();

    return { store, owner, buyer, buyer2, buyer3 };
  }

  //Tests executed with owner logic.
  describe("Owner", function () {
    let allProducts;

    it("should be able to add new product with quantity", async function () {
      const { store } = await loadFixture(provideStore);

      //Add product with quantity.
      let productOneAddedResult = await addProductAndExtractProductId(
        store,
        Events.ProductAdded
      );

      //Verify that the product is initially added with the desired quantity.
      allProducts = await store.getAllProducts();
      expect(allProducts).to.deep.include([
        productOneAddedResult.name,
        productOneAddedResult.quantity,
      ]);
    });

    it("should not be able to add the same product twice, just quantity", async function () {
      const { store } = await loadFixture(provideStore);

      //Add product with quantity.
      let productOneAddedResult = await addProductAndExtractProductId(
        store,
        Events.ProductAdded
      );

      let productOneUpdatedResult = await addProductAndExtractProductId(
        store,
        Events.ProductUpdated,
        productOneAddedResult.name
      );

      //Verify that the quantity is updated of an existing product.
      allProducts = await store.getAllProducts();
      expect(allProducts).to.deep.include([
        productOneAddedResult.name,
        productOneUpdatedResult.quantity,
      ]);
      //Verify that the product is not duplicated.
      expect(allProducts.length).to.equal(1);
    });
  });

  describe("Buyer", function () {
    it("should be able to see the available products and buy them by their id", async function () {
      const { store, owner, buyer } = await loadFixture(provideStore);

      //Add two products with quantities.
      let productOneAddedResult = await addProductAndExtractProductId(
        store,
        Events.ProductAdded
      );

      let productTwoAddedResult = await addProductAndExtractProductId(
        store,
        Events.ProductAdded
      );
      let addedProductResults = [productOneAddedResult, productTwoAddedResult];

      //Verify that the products are available.
      allProducts = await store.getAllProducts();
      expect(allProducts).to.deep.include(
        [productOneAddedResult.name, productOneAddedResult.quantity],
        [productTwoAddedResult.name, productTwoAddedResult.quantity]
      );

      //Verify that the buyer can buy the products.
      for (let product in addedProductResults) {
        let id = addedProductResults[product]["id"];
        await buyProductAndVerifyEvent(store, true, id, buyer);
      }
    });

    it("should be able to return products if they are not satisfied within blocktime: 100 blocks", async function () {
      const { store, owner, buyer } = await loadFixture(provideStore);

      //Add a product with quantities.
      let productAddedResult = await addProductAndExtractProductId(
        store,
        Events.ProductAdded
      );

      //Set refund policy blocktime to 100.
      await store.setRefundPolicyNumber(100);

      //Buy a product.
      await buyProductAndVerifyEvent(
        store,
        true,
        productAddedResult["id"],
        buyer
      );

      //Mine 50 blocks.
      await mine(50);
      //Try to return the product after the configured blocktime.
      await refundProductAndVerifyEvent(
        store,
        true,
        productAddedResult["id"],
        buyer
      );
    });

    it("should not be able to return products if they have exceeded the blocktime: 100 blocks", async function () {
      const { store, owner, buyer } = await loadFixture(provideStore);

      //Add a product with quantities.
      let productAddedResult = await addProductAndExtractProductId(
        store,
        Events.ProductAdded
      );

      //Set refund policy blocktime to 100.
      await store.setRefundPolicyNumber(100);

      //Buy a product.
      await buyProductAndVerifyEvent(
        store,
        true,
        productAddedResult["id"],
        buyer
      );

      //Mine 150 blocks.
      await mine(150);
      //Try to return the product after the configured blocktime and verify that it is not possible.
      await refundProductAndVerifyEvent(
        store,
        false,
        productAddedResult["id"],
        buyer
      ); //TODO
    });

    it("should not be able to buy the same product more than one time", async function () {
      const { store, owner, buyer } = await loadFixture(provideStore);

      //Add a product with quantities.
      let productAddedResult = await addProductAndExtractProductId(
        store,
        Events.ProductAdded
      );

      //Buy a product.
      await buyProductAndVerifyEvent(
        store,
        true,
        productAddedResult["id"],
        buyer
      );
      //Try to buy the same product again and verify that it is not possible.
      await buyProductAndVerifyEvent(
        store,
        false,
        productAddedResult["id"],
        buyer
      );
    });

    it("should not be able to buy a product more times than the quantity, unless a product is returned/added", async function () {
      const { store, owner, buyer, buyer2, buyer3 } = await loadFixture(
        provideStore
      );

      //Add a product with quantity 2.
      let productAddedResult = await addProductAndExtractProductId(
        store,
        Events.ProductAdded,
        undefined,
        2
      );

      //Buy the product.
      await buyProductAndVerifyEvent(
        store,
        true,
        productAddedResult["id"],
        buyer
      );

      //Buy the second(last) product.
      await buyProductAndVerifyEvent(
        store,
        true,
        productAddedResult["id"],
        buyer2
      );

      //Try to buy an additional product.
      await buyProductAndVerifyEvent(
        store,
        false,
        productAddedResult["id"],
        buyer3,
        "Quantity can't be 0!"
      );

      //Return a product
      await expect(
        store.connect(buyer2).refundProduct(productAddedResult["id"])
      ).to.emit(store, Events.ProductRefund);

      //Verify that the quantity is updated and the product is returned.
      allProducts = await store.getAllProducts();
      expect(allProducts.length).to.equal(1);

      //Verify that the returned product can be bought.
      await buyProductAndVerifyEvent(
        store,
        true,
        productAddedResult["id"],
        buyer3
      );
    });
  });
});

//==========HELPER FUNCTIONS==========
//The function is meant to add/update product and to capture the event in order to get the transaction details and product ID.
//store - intializes the store.
//event - provides the expected event from Events enum.
//productName - productName is randomly generated if not provided.
//productQuantity - productQuantity is randomly generated if not provided.
async function addProductAndExtractProductId(
  store,
  event,
  productName,
  productQuantity
) {
  //Generate random product name and product quantity in case it is not provided.
  if (productName === undefined) {
    productName = (Math.random() + 1).toString(36).substring(5);
  }

  if (productQuantity === undefined) {
    productQuantity = Math.floor(Math.random() * 9) + 1;
  }

  let capturedValue;
  const captureValue = (value) => {
    //Captured value holds the event.
    capturedValue = value;
    return true;
  };

  await expect(store.addProduct(productName, productQuantity))
    .to.emit(store, event)
    .withArgs(captureValue, productName, productQuantity);
  return {
    id: capturedValue.toNumber(),
    name: productName,
    quantity: productQuantity,
  };
}

//The function is meant to verify the event for Product bought.
//store - intializes the store.
//expectEvent - should be set to false while executing an operation which is not publishing an event.
//productId - the id of the product extracted from addProductAndExtractProductId function.
//buyer - used to change the rights from owner to client.
//exception - used to specify an expected exception.
async function buyProductAndVerifyEvent(
  store,
  expectEvent,
  productId,
  buyer,
  exception
) {
  if (exception === undefined) {
    exception = "You cannot buy the same product more than once!";
  }

  if (expectEvent) {
    await expect(store.connect(buyer).buyProduct(productId)).to.emit(
      store,
      Events.ProductBought
    );
  } else {
    await expect(store.connect(buyer).buyProduct(productId)).to.revertedWith(
      exception
    );
  }
}

//The function is meant to verify the event for Product refund.
//store - intializes the store.
//expectEvent - should be set to false while executing an operation which is not publishing an event.
//productId - the id of the product extracted from addProductAndExtractProductId function.
//buyer - used to change the rights from owner to client.
async function refundProductAndVerifyEvent(
  store,
  expectEvent,
  productId,
  buyer
) {
  if (expectEvent) {
    await expect(store.connect(buyer).refundProduct(productId)).to.emit(
      store,
      Events.ProductRefund
    );
  } else {
    await expect(store.connect(buyer).refundProduct(productId)).to.revertedWith(
      "Sorry, your request for refund has been denied."
    );
  }
}
