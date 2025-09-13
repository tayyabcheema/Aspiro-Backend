const errorHandler = (err, req, res, next) => {
    const status = err.status || 500;
    const message = err.message || "Internal Server Error";
  
    if (err.success) {
      return res.status(status).json({
        success: true,
        message,
        data: err.data || null,
      });
    }
  
    return res.status(status).json({
      success: false,
      message,
    });
  };
  
  module.exports = errorHandler;