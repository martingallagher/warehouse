import { expect, use } from "chai";
import { deployContract, MockProvider, solidity } from "ethereum-waffle";
import { Contract, utils, Wallet } from "ethers";
import Warehouse from "../build/Warehouse.json";

use(solidity);

describe("Warehouse", async () => {
  const managerRequiredError =
    "Only the warehouse manager can perform this function.";
  const originalManager = Wallet.createRandom();
  const originalCustomer = Wallet.createRandom();
  const originalOtherCustomer = Wallet.createRandom();
  const oneEth = utils.parseEther("1");
  const provider = new MockProvider({
    ganacheOptions: {
      accounts: [
        {
          balance: oneEth.toString(),
          secretKey: originalManager.privateKey,
        },
        {
          balance: oneEth.toString(),
          secretKey: originalCustomer.privateKey,
        },
        {
          balance: oneEth.toString(),
          secretKey: originalOtherCustomer.privateKey,
        },
      ],
    },
  });
  const [manager, customer, otherCustomer] = provider.getWallets();
  let warehouse: Contract;

  beforeEach(
    async () => (warehouse = await deployContract(manager, Warehouse))
  );

  it("Manager can add products", async () => {
    await expect(warehouse.addProduct(1000000, 1, "Widget A"))
      .to.emit(warehouse, "NewProduct")
      .withArgs(0);
    await expect(warehouse.addProduct(500000, 3, "Widget B"))
      .to.emit(warehouse, "NewProduct")
      .withArgs(1);

    const productA = await warehouse.getProduct(0);
    const productB = await warehouse.getProduct(1);

    expect(productA[2]).to.equal("Widget A");
    expect(productA[3]).to.equal(true);
    expect(productB[2]).to.equal("Widget B");
    expect(productB[3]).to.equal(true);
  });

  it("Manager can update stock count", async () => {
    await expect(warehouse.addProduct(1000000, 1, "Widget"))
      .to.emit(warehouse, "NewProduct")
      .withArgs(0);

    const before = await warehouse.getProduct(0);

    expect(before[1]).to.equal(1);

    await warehouse.setProductStock(0, 99);

    const after = await warehouse.getProduct(0);

    expect(after[1]).to.equal(99);
  });

  it("Customer cannot update stock or add products", async () => {
    // Acting as manager
    await expect(warehouse.addProduct(123456789, 1, "Widget"))
      .to.emit(warehouse, "NewProduct")
      .withArgs(0);

    // Acting as customer
    const asCustomer = warehouse.connect(customer);

    await expect(asCustomer.setProductStock(0, 99)).to.be.revertedWith(
      managerRequiredError
    );
    await expect(
      asCustomer.addProduct(700000, 1, "Widget C")
    ).to.be.revertedWith(managerRequiredError);
  });

  it("Customer can create a new order", async () => {
    const price = 10000;
    const count = 10;

    await expect(warehouse.addProduct(price, count, "Widget"))
      .to.emit(warehouse, "NewProduct")
      .withArgs(0);

    const asCustomer = warehouse.connect(customer);

    await expect(asCustomer.newOrder(0, { value: 1000 })).to.be.revertedWith(
      "Insufficient funds."
    );

    const balanceBefore = await customer.getBalance();
    const resp = await asCustomer.newOrder(0, { value: price });

    expect(resp).to.emit(warehouse, "NewOrder").withArgs(0, customer.address);

    const asOtherCustomer = warehouse.connect(otherCustomer);

    // Only the customer who made the order, or the manager can view
    await expect(asOtherCustomer.getOrder(0)).to.be.revertedWith(
      "Only the order customer or the warehouse manager can view the order."
    );

    const fee = resp.gasPrice.mul(resp.gasLimit);
    const balanceAfter = await customer.getBalance();

    expect(balanceAfter.add(fee).add(price)).to.equal(balanceBefore);

    const warehouseBalance = await provider.getBalance(warehouse.address);

    expect(warehouseBalance).to.equal(price);

    // Product stock should be decremented
    const product = await warehouse.getProduct(0);

    expect(product[1]).to.equal(count - 1);
  });

  it("Customer order rejected due to low stock", async () => {
    const price = 10000;

    await expect(warehouse.addProduct(price, 0, "Widget"))
      .to.emit(warehouse, "NewProduct")
      .withArgs(0);

    const asCustomer = warehouse.connect(customer);

    await expect(asCustomer.newOrder(0, { value: price })).to.be.revertedWith(
      "Product is out of stock."
    );
  });

  it("Manager can ship a order", async () => {
    const price = 10000;
    const count = 10;

    await expect(warehouse.addProduct(price, count, "Widget"))
      .to.emit(warehouse, "NewProduct")
      .withArgs(0);

    const asCustomer = warehouse.connect(customer);
    const resp = await asCustomer.newOrder(0, { value: price });

    expect(resp).to.emit(warehouse, "NewOrder").withArgs(0, customer.address);

    let order = await asCustomer.getOrder(0);

    expect(order[2]).to.be.false;

    // Fail to ship as customer
    await expect(asCustomer.shipOrder(0)).to.be.revertedWith(
      managerRequiredError
    );

    await warehouse.shipOrder(0);

    order = await asCustomer.getOrder(0);

    expect(order[2]).to.be.true;

    const product = await warehouse.getProduct(0);

    expect(product[1]).to.equal(count - 1);
  });
});
