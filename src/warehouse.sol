// SPDX-License-Identifier: MIT
pragma solidity ^0.8.10;

contract Manager {
    constructor() {
        owner = payable(msg.sender);
    }

    address payable owner;

    modifier onlyManager() {
        require(
            msg.sender == owner,
            "Only the warehouse manager can perform this function."
        );
        _;
    }
}

contract Warehouse is Manager {
    struct Product {
        uint256 price;
        uint32 count;
        string description;
        bool exists;
    }

    struct Order {
        address customer;
        uint256 productID;
        bool shipped;
        bool exists;
    }

    event NewProduct(uint256 indexed id);

    event NewOrder(uint256 indexed id, address customer);

    // Product inventory
    Product[] inventory;
    // Order history
    Order[] orders;

    function getProduct(uint256 id) public view returns (Product memory) {
        Product memory product = inventory[id];

        require(product.exists, "Product does not exists.");

        return product;
    }

    function addProduct(
        uint256 price,
        uint32 stock,
        string memory description
    ) public onlyManager {
        require(price > 0, "Price must be a non-zero value.");

        inventory.push(Product(price, stock, description, true));

        emit NewProduct(inventory.length - 1);
    }

    function setProductStock(uint256 id, uint32 count) public onlyManager {
        require(inventory[id].exists, "Product does not exists.");

        inventory[id].count = count;
    }

    function getOrder(uint256 id) public view returns (Order memory) {
        Order memory order = orders[id];

        require(order.exists, "Order does not exists.");
        require(
            msg.sender == owner || msg.sender == order.customer,
            "Only the order customer or the warehouse manager can view the order."
        );

        return order;
    }

    function newOrder(uint256 productID) public payable {
        require(msg.sender != owner, "Warehouse manager cannot make orders.");

        Product memory product = inventory[productID];

        require(product.exists, "Product does not exists.");
        require(product.count > 0, "Product is out of stock.");
        require(msg.value == product.price, "Insufficient funds.");

        orders.push(Order(msg.sender, productID, false, true));
        inventory[productID].count -= 1;

        emit NewOrder(orders.length - 1, msg.sender);
    }

    function shipOrder(uint256 id) public onlyManager {
        require(orders[id].exists, "Order does not exists.");

        orders[id].shipped = true;
    }
}
