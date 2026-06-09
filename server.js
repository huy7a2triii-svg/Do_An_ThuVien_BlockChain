const express = require('express');
const SHA256 = require('crypto-js/sha256');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ==================== CORE BLOCKCHAIN ====================

class Block {
    constructor(index, timestamp, transactions, previousHash = '') {
        this.index = index;
        this.timestamp = timestamp;
        this.transactions = transactions; // Dữ liệu mượn/trả sách
        this.previousHash = previousHash;
        this.nonce = 0;
        this.hash = this.calculateHash();
    }

    // Hàm tính toán mã mã băm SHA-256
    calculateHash() {
        return SHA256(
            this.index + 
            this.previousHash + 
            this.timestamp + 
            JSON.stringify(this.transactions) + 
            this.nonce
        ).toString();
    }

    // Cơ chế đồng thuận Proof of Work (Đào block)
    mineBlock(difficulty) {
        // Tìm hash có số lượng số 0 ở đầu bằng với độ khó (difficulty)
        while (this.hash.substring(0, difficulty) !== Array(difficulty + 1).join("0")) {
            this.nonce++;
            this.hash = this.calculateHash();
        }
        console.log(`[BLOCKCHAIN] Khối số ${this.index} đã được đào thành công: ${this.hash}`);
    }
}

class Blockchain {
    constructor() {
        this.resetChain(); // Khởi tạo chuỗi ban đầu
    }

    // Tạo khối đầu tiên (Khối khởi nguyên)
    createGenesisBlock() {
        return new Block(0, "09/06/2026", "Genesis Block - Thư viện Thành lập", "0");
    }

    // Hàm thực thi việc Reset/Làm mới chuỗi
    resetChain() {
        this.chain = [this.createGenesisBlock()];
        this.difficulty = 2; // Độ khó đóng khối
        this.pendingTransactions = []; // Xóa rỗng hàng chờ giao dịch
    }

    getLatestBlock() {
        return this.chain[this.chain.length - 1];
    }

    // Tạo một giao dịch mượn/trả sách mới
    createTransaction(studentId, action, bookName) {
        const tx = {
            studentId: studentId,
            action: action, // "Mượn sách" hoặc "Trả sách"
            bookName: bookName,
            timestamp: new Date().toLocaleString('vi-VN')
        };
        this.pendingTransactions.push(tx);
        return tx;
    }

    // Đào các giao dịch đang chờ thành một khối mới
    minePendingTransactions() {
        if (this.pendingTransactions.length === 0) {
            return null;
        }

        let block = new Block(
            this.chain.length, 
            new Date().toLocaleString('vi-VN'), 
            this.pendingTransactions, 
            this.getLatestBlock().hash
        );
        
        block.mineBlock(this.difficulty);
        this.chain.push(block);

        // Xóa danh sách chờ sau khi đã đóng khối thành công
        this.pendingTransactions = [];
        return block;
    }

    // Hàm kiểm thử toàn vẹn (Hệ thống chống hack)
    isChainValid() {
        for (let i = 1; i < this.chain.length; i++) {
            const currentBlock = this.chain[i];
            const previousBlock = this.chain[i - 1];

            // 1. Kiểm tra xem dữ liệu trong block có bị sửa đổi không
            if (currentBlock.hash !== currentBlock.calculateHash()) {
                return { valid: false, reason: `Khối số ${i} dữ liệu đã bị sửa đổi trái phép!` };
            }

            // 2. Kiểm tra mối liên kết với khối trước đó
            if (currentBlock.previousHash !== previousBlock.hash) {
                return { valid: false, reason: `Khối số ${i} bị ngắt liên kết với Khối số ${i-1}!` };
            }
        }
        return { valid: true };
    }
}

// Khởi tạo một mạng Blockchain thư viện toàn cục
const libraryChain = new Blockchain();

// ==================== CÁC API HỆ THỐNG ====================

// API lấy toàn bộ chuỗi blockchain để hiển thị lên UI
app.get('/api/chain', (req, res) => {
    res.json({
        chain: libraryChain.chain,
        isValid: libraryChain.isChainValid()
    });
});

// API lấy các giao dịch đang chờ xử lý
app.get('/api/pending', (req, res) => {
    res.json(libraryChain.pendingTransactions);
});

// API gửi yêu cầu mượn/trả sách từ Sinh viên
app.post('/api/transaction', (req, res) => {
    const { studentId, action, bookName } = req.body;
    if (!studentId || !action || !bookName) {
        return res.status(400).json({ error: "Thiếu thông tin giao dịch!" });
    }
    const tx = libraryChain.createTransaction(studentId, action, bookName);
    res.json({ message: "Giao dịch đã được thêm vào hàng chờ!", transaction: tx });
});

// API dành cho thủ thư kích hoạt quá trình Đóng khối & Đào dữ liệu
app.post('/api/mine', (req, res) => {
    const newBlock = libraryChain.minePendingTransactions();
    if (!newBlock) {
        return res.status(400).json({ error: "Không có giao dịch nào đang chờ để đào!" });
    }
    res.json({ message: "Đóng khối thành công!", block: newBlock });
});

// API GIẢ LẬP HACK DỮ LIỆU
app.post('/api/hack', (req, res) => {
    if (libraryChain.chain.length < 2) {
        return res.status(400).json({ error: "Chuỗi chưa đủ dài để thực hiện hack. Hãy tạo và đào ít nhất 1 block!" });
    }
    // Giả lập hacker thâm nhập DB sửa đổi thông tin của khối thứ 1 (ngay sau Genesis block)
    libraryChain.chain[1].transactions = [{
        studentId: "HACKER",
        action: "Đã xóa lịch sử phạt",
        bookName: "Sách đã bị đánh cắp",
        timestamp: "00:00:00"
    }];
    res.json({ message: "Hacker đã can thiệp thay đổi dữ liệu tại Khối số 1 thành công!" });
});

// API RESET BLOCKCHAIN (Mới bổ sung để đồng bộ với UI)
app.post('/api/reset', (req, res) => {
    libraryChain.resetChain();
    console.log(`[BLOCKCHAIN] Toàn bộ chuỗi khối đã được đưa về trạng thái khởi nguyên.`);
    res.json({ message: "Đã reset toàn bộ hệ thống Blockchain về trạng thái ban đầu!" });
});

// Khởi chạy server tại cổng 3000
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`==================================================`);
    console.log(`SERVER QUẢN LÝ THƯ VIỆN BLOCKCHAIN ĐANG CHẠY!`);
    console.log(`Địa chỉ local: http://localhost:${PORT}`);
    console.log(`==================================================`);
});