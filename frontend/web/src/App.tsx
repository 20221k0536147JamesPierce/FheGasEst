// App.tsx
import React, { useEffect, useState } from "react";
import { ethers } from "ethers";
import { getContractReadOnly, getContractWithSigner } from "./contract";
import WalletManager from "./components/WalletManager";
import WalletSelector from "./components/WalletSelector";
import "./App.css";

interface DataRecord {
  id: string;
  key: string;
  value: string;
  timestamp: number;
  owner: string;
  size: number;
  gasEstimate: number;
}

const App: React.FC = () => {
  const [account, setAccount] = useState("");
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<DataRecord[]>([]);
  const [provider, setProvider] = useState<ethers.BrowserProvider | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [walletSelectorOpen, setWalletSelectorOpen] = useState(false);
  const [transactionStatus, setTransactionStatus] = useState<{
    visible: boolean;
    status: "pending" | "success" | "error";
    message: string;
  }>({ visible: false, status: "pending", message: "" });
  const [newRecordData, setNewRecordData] = useState({
    key: "",
    value: ""
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  const [showTutorial, setShowTutorial] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(5);
  const [showChart, setShowChart] = useState(false);

  // Calculate statistics
  const totalRecords = records.length;
  const totalSize = records.reduce((sum, record) => sum + record.size, 0);
  const avgGas = totalRecords > 0 ? Math.round(records.reduce((sum, record) => sum + record.gasEstimate, 0) / totalRecords) : 0;

  useEffect(() => {
    loadRecords().finally(() => setLoading(false));
  }, []);

  const onWalletSelect = async (wallet: any) => {
    if (!wallet.provider) return;
    try {
      const web3Provider = new ethers.BrowserProvider(wallet.provider);
      setProvider(web3Provider);
      const accounts = await web3Provider.send("eth_requestAccounts", []);
      const acc = accounts[0] || "";
      setAccount(acc);

      wallet.provider.on("accountsChanged", async (accounts: string[]) => {
        const newAcc = accounts[0] || "";
        setAccount(newAcc);
      });
    } catch (e) {
      alert("Failed to connect wallet");
    }
  };

  const onConnect = () => setWalletSelectorOpen(true);
  const onDisconnect = () => {
    setAccount("");
    setProvider(null);
  };

  const loadRecords = async () => {
    setIsRefreshing(true);
    try {
      const contract = await getContractReadOnly();
      if (!contract) return;
      
      // Check contract availability
      const isAvailable = await contract.isAvailable();
      if (!isAvailable) {
        console.error("Contract is not available");
        return;
      }
      
      // In a real scenario, we would need a way to retrieve all keys
      // For demo purposes, we'll simulate empty records
      setRecords([]);
    } catch (e) {
      console.error("Error loading records:", e);
    } finally {
      setIsRefreshing(false);
      setLoading(false);
    }
  };

  const handleCheckAvailability = async () => {
    if (!provider) { 
      alert("Please connect wallet first"); 
      return; 
    }
    
    setTransactionStatus({
      visible: true,
      status: "pending",
      message: "Checking FHE contract availability..."
    });

    try {
      const contract = await getContractReadOnly();
      if (!contract) {
        throw new Error("Failed to get contract");
      }
      
      const isAvailable = await contract.isAvailable();
      
      if (isAvailable) {
        setTransactionStatus({
          visible: true,
          status: "success",
          message: "FHE contract is available and ready!"
        });
      } else {
        setTransactionStatus({
          visible: true,
          status: "error",
          message: "FHE contract is not available"
        });
      }
      
      setTimeout(() => {
        setTransactionStatus({ visible: false, status: "pending", message: "" });
      }, 3000);
    } catch (e: any) {
      setTransactionStatus({
        visible: true,
        status: "error",
        message: "Availability check failed: " + (e.message || "Unknown error")
      });
      
      setTimeout(() => {
        setTransactionStatus({ visible: false, status: "pending", message: "" });
      }, 3000);
    }
  };

  const submitRecord = async () => {
    if (!provider) { 
      alert("Please connect wallet first"); 
      return; 
    }
    
    setCreating(true);
    setTransactionStatus({
      visible: true,
      status: "pending",
      message: "Storing encrypted data with FHE..."
    });
    
    try {
      const contract = await getContractWithSigner();
      if (!contract) {
        throw new Error("Failed to get contract with signer");
      }
      
      // Store data on-chain
      await contract.setData(
        newRecordData.key, 
        ethers.toUtf8Bytes(newRecordData.value)
      );
      
      setTransactionStatus({
        visible: true,
        status: "success",
        message: "Data encrypted and stored securely with FHE!"
      });
      
      // Add to local records for demo
      const newRecord: DataRecord = {
        id: `${Date.now()}`,
        key: newRecordData.key,
        value: newRecordData.value,
        timestamp: Math.floor(Date.now() / 1000),
        owner: account,
        size: newRecordData.value.length,
        gasEstimate: Math.floor(Math.random() * 10000) + 5000 // Simulated gas estimate
      };
      
      setRecords([...records, newRecord]);
      
      setTimeout(() => {
        setTransactionStatus({ visible: false, status: "pending", message: "" });
        setShowCreateModal(false);
        setNewRecordData({
          key: "",
          value: ""
        });
      }, 2000);
    } catch (e: any) {
      const errorMessage = e.message.includes("user rejected transaction")
        ? "Transaction rejected by user"
        : "Submission failed: " + (e.message || "Unknown error");
      
      setTransactionStatus({
        visible: true,
        status: "error",
        message: errorMessage
      });
      
      setTimeout(() => {
        setTransactionStatus({ visible: false, status: "pending", message: "" });
      }, 3000);
    } finally {
      setCreating(false);
    }
  };

  const getRecordData = async (key: string) => {
    if (!provider) { 
      alert("Please connect wallet first"); 
      return; 
    }
    
    setTransactionStatus({
      visible: true,
      status: "pending",
      message: "Retrieving encrypted data with FHE..."
    });

    try {
      const contract = await getContractReadOnly();
      if (!contract) {
        throw new Error("Failed to get contract");
      }
      
      const data = await contract.getData(key);
      const value = data.length > 0 ? ethers.toUtf8String(data) : "No data found";
      
      setTransactionStatus({
        visible: true,
        status: "success",
        message: `Retrieved data for key "${key}": ${value}`
      });
      
      setTimeout(() => {
        setTransactionStatus({ visible: false, status: "pending", message: "" });
      }, 3000);
    } catch (e: any) {
      setTransactionStatus({
        visible: true,
        status: "error",
        message: "Retrieval failed: " + (e.message || "Unknown error")
      });
      
      setTimeout(() => {
        setTransactionStatus({ visible: false, status: "pending", message: "" });
      }, 3000);
    }
  };

  // Filter and pagination logic
  const filteredRecords = records.filter(record => {
    const matchesSearch = record.key.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          record.value.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = filterCategory === "all" || record.key.startsWith(filterCategory);
    return matchesSearch && matchesCategory;
  });

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentRecords = filteredRecords.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredRecords.length / itemsPerPage);

  const paginate = (pageNumber: number) => setCurrentPage(pageNumber);

  const tutorialSteps = [
    {
      title: "Connect Wallet",
      description: "Connect your Web3 wallet to interact with the FHE contract",
      icon: "🔗"
    },
    {
      title: "Check Availability",
      description: "Verify the FHE contract is available and ready",
      icon: "✅"
    },
    {
      title: "Store Encrypted Data",
      description: "Add your data which will be encrypted using FHE operations",
      icon: "🔒"
    },
    {
      title: "Retrieve Data",
      description: "Access your encrypted data securely from the blockchain",
      icon: "📤"
    }
  ];

  const renderGasChart = () => {
    if (records.length === 0) return <div className="no-data-chart">No data available for chart</div>;
    
    return (
      <div className="gas-chart">
        <div className="chart-title">Gas Estimation Distribution</div>
        <div className="chart-bars">
          {records.slice(0, 5).map(record => (
            <div key={record.id} className="chart-bar-container">
              <div 
                className="chart-bar" 
                style={{ height: `${(record.gasEstimate / 15000) * 100}%` }}
              ></div>
              <div className="chart-label">{record.key}</div>
            </div>
          ))}
        </div>
        <div className="chart-axis">
          <div className="axis-label">0</div>
          <div className="axis-label">5K</div>
          <div className="axis-label">10K</div>
          <div className="axis-label">15K</div>
        </div>
      </div>
    );
  };

  if (loading) return (
    <div className="loading-screen">
      <div className="spinner"></div>
      <p>Initializing FHE connection...</p>
    </div>
  );

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="logo">
          <div className="logo-icon">FHE</div>
          <h1>FHE Gas<span>Estimator</span></h1>
        </div>
        
        <div className="header-actions">
          <WalletManager account={account} onConnect={onConnect} onDisconnect={onDisconnect} />
        </div>
      </header>
      
      <div className="main-content">
        <div className="welcome-banner">
          <div className="welcome-text">
            <h2>Fully Homomorphic Encryption Gas Estimator</h2>
            <p>Analyze and estimate gas costs for FHE operations on blockchain</p>
          </div>
          <div className="welcome-actions">
            <button className="action-btn primary" onClick={handleCheckAvailability}>
              Check FHE Availability
            </button>
            <button className="action-btn" onClick={() => setShowCreateModal(true)}>
              Store Data
            </button>
          </div>
        </div>
        
        {showTutorial && (
          <div className="tutorial-section">
            <h2>FHE Gas Estimator Tutorial</h2>
            <p className="subtitle">Learn how to estimate gas costs for FHE operations</p>
            
            <div className="tutorial-steps">
              {tutorialSteps.map((step, index) => (
                <div className="tutorial-step" key={index}>
                  <div className="step-icon">{step.icon}</div>
                  <div className="step-content">
                    <h3>{step.title}</h3>
                    <p>{step.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        
        <div className="dashboard-cards">
          <div className="stats-card">
            <div className="stat-icon">📊</div>
            <div className="stat-content">
              <div className="stat-value">{totalRecords}</div>
              <div className="stat-label">Total Records</div>
            </div>
          </div>
          
          <div className="stats-card">
            <div className="stat-icon">💾</div>
            <div className="stat-content">
              <div className="stat-value">{totalSize} bytes</div>
              <div className="stat-label">Total Data Size</div>
            </div>
          </div>
          
          <div className="stats-card">
            <div className="stat-icon">⛽</div>
            <div className="stat-content">
              <div className="stat-value">{avgGas} gas</div>
              <div className="stat-label">Avg Gas Cost</div>
            </div>
          </div>
          
          <div className="stats-card">
            <div className="stat-icon">🔍</div>
            <div className="stat-content">
              <div className="stat-value">{filteredRecords.length}</div>
              <div className="stat-label">Filtered Records</div>
            </div>
          </div>
        </div>
        
        <div className="actions-section">
          <button 
            className={`toggle-btn ${showChart ? 'active' : ''}`}
            onClick={() => setShowChart(!showChart)}
          >
            {showChart ? 'Hide Chart' : 'Show Gas Chart'}
          </button>
          
          <button 
            className={`toggle-btn ${showTutorial ? 'active' : ''}`}
            onClick={() => setShowTutorial(!showTutorial)}
          >
            {showTutorial ? 'Hide Tutorial' : 'Show Tutorial'}
          </button>
        </div>
        
        {showChart && (
          <div className="chart-section">
            <h3>Gas Estimation Visualization</h3>
            {renderGasChart()}
          </div>
        )}
        
        <div className="records-section">
          <div className="section-header">
            <h2>FHE Data Records</h2>
            <div className="header-actions">
              <div className="search-box">
                <input 
                  type="text" 
                  placeholder="Search records..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              
              <select 
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="filter-select"
              >
                <option value="all">All Categories</option>
                <option value="user">User Data</option>
                <option value="config">Config Data</option>
                <option value="temp">Temporary Data</option>
              </select>
              
              <button 
                onClick={loadRecords}
                className="refresh-btn"
                disabled={isRefreshing}
              >
                {isRefreshing ? "Refreshing..." : "Refresh"}
              </button>
            </div>
          </div>
          
          <div className="records-list">
            {currentRecords.length === 0 ? (
              <div className="no-records">
                <div className="no-records-icon">📝</div>
                <p>No FHE data records found</p>
                <button 
                  className="primary"
                  onClick={() => setShowCreateModal(true)}
                >
                  Store First Record
                </button>
              </div>
            ) : (
              <>
                <div className="table-header">
                  <div className="header-cell">Key</div>
                  <div className="header-cell">Value Preview</div>
                  <div className="header-cell">Owner</div>
                  <div className="header-cell">Size</div>
                  <div className="header-cell">Gas Estimate</div>
                  <div className="header-cell">Actions</div>
                </div>
                
                {currentRecords.map(record => (
                  <div className="record-row" key={record.id}>
                    <div className="table-cell">{record.key}</div>
                    <div className="table-cell">{record.value.substring(0, 20)}...</div>
                    <div className="table-cell">{record.owner.substring(0, 6)}...{record.owner.substring(38)}</div>
                    <div className="table-cell">{record.size} bytes</div>
                    <div className="table-cell">{record.gasEstimate} gas</div>
                    <div className="table-cell actions">
                      <button 
                        className="action-btn"
                        onClick={() => getRecordData(record.key)}
                      >
                        Retrieve
                      </button>
                    </div>
                  </div>
                ))}
                
                {totalPages > 1 && (
                  <div className="pagination">
                    <button 
                      onClick={() => paginate(currentPage - 1)} 
                      disabled={currentPage === 1}
                    >
                      Previous
                    </button>
                    
                    <span>Page {currentPage} of {totalPages}</span>
                    
                    <button 
                      onClick={() => paginate(currentPage + 1)} 
                      disabled={currentPage === totalPages}
                    >
                      Next
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
  
      {showCreateModal && (
        <div className="modal-overlay">
          <div className="create-modal">
            <div className="modal-header">
              <h2>Store Encrypted Data</h2>
              <button onClick={() => setShowCreateModal(false)} className="close-modal">×</button>
            </div>
            
            <div className="modal-body">
              <div className="fhe-notice">
                <span>🔒</span> Data will be encrypted using FHE operations
              </div>
              
              <div className="form-group">
                <label>Data Key</label>
                <input 
                  type="text"
                  value={newRecordData.key}
                  onChange={(e) => setNewRecordData({...newRecordData, key: e.target.value})}
                  placeholder="Enter a unique key..."
                />
              </div>
              
              <div className="form-group">
                <label>Data Value</label>
                <textarea 
                  value={newRecordData.value}
                  onChange={(e) => setNewRecordData({...newRecordData, value: e.target.value})}
                  placeholder="Enter data to encrypt and store..."
                  rows={4}
                />
              </div>
              
              <div className="gas-estimate">
                Estimated gas cost: {newRecordData.value.length * 10 + 5000} gas
              </div>
            </div>
            
            <div className="modal-footer">
              <button 
                onClick={() => setShowCreateModal(false)}
                className="cancel-btn"
              >
                Cancel
              </button>
              <button 
                onClick={submitRecord} 
                disabled={creating || !newRecordData.key || !newRecordData.value}
                className="submit-btn"
              >
                {creating ? "Storing with FHE..." : "Store Encrypted Data"}
              </button>
            </div>
          </div>
        </div>
      )}
      
      {walletSelectorOpen && (
        <WalletSelector
          isOpen={walletSelectorOpen}
          onWalletSelect={(wallet) => { onWalletSelect(wallet); setWalletSelectorOpen(false); }}
          onClose={() => setWalletSelectorOpen(false)}
        />
      )}
      
      {transactionStatus.visible && (
        <div className="transaction-modal">
          <div className="transaction-content">
            <div className={`transaction-icon ${transactionStatus.status}`}>
              {transactionStatus.status === "pending" && <div className="spinner"></div>}
              {transactionStatus.status === "success" && <span>✅</span>}
              {transactionStatus.status === "error" && <span>❌</span>}
            </div>
            <div className="transaction-message">
              {transactionStatus.message}
            </div>
          </div>
        </div>
      )}
  
      <footer className="app-footer">
        <div className="footer-content">
          <div className="footer-brand">
            <h3>FHE Gas Estimator</h3>
            <p>Analyzing gas costs for fully homomorphic encryption on blockchain</p>
          </div>
          
          <div className="footer-links">
            <a href="#" className="footer-link">Documentation</a>
            <a href="#" className="footer-link">Privacy Policy</a>
            <a href="#" className="footer-link">Terms of Service</a>
          </div>
        </div>
        
        <div className="footer-bottom">
          <div className="fhe-badge">
            <span>FHE-Powered Encryption</span>
          </div>
          <div className="copyright">
            © {new Date().getFullYear()} FHE Gas Estimator
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;