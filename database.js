const sql = require('mssql/msnodesqlv8')
// ✅ Database configuration
const config = {
    server: 'INMAL00027\\EMILGET',  
    database: 'OTManagementDB',   
    driver: 'msnodesqlv8',
    options: {
        trustedConnection: true,
         requestTimeout: 900000
    }
};

// ✅ Create pool
const pool = new sql.ConnectionPool(config);
// ✅ Connect to the pool
const poolConnect = pool.connect()
    .then(() => console.log("✅ SQL Pool connected successfully"))
    .catch(err => console.error("❌ SQL Pool Error:", err));
module.exports = { sql, pool, poolConnect };

