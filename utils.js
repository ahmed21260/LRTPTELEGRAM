const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const ExifParser = require('exif-parser');
const moment = require('moment');

class Utils {
  // Extract EXIF data from image
  static async extractExifData(filePath) {
    try {
      const buffer = fs.readFileSync(filePath);
      const parser = ExifParser.create(buffer);
      const result = parser.parse();

      if (result && result.tags) {
        return {
          dateTime: result.tags.DateTime ? moment(result.tags.DateTime * 1000).toISOString() : null,
          gpsLatitude: result.gps ? result.gps.GPSLatitude : null,
          gpsLongitude: result.gps ? result.gps.GPSLongitude : null,
          gpsAltitude: result.gps ? result.gps.GPSAltitude : null,
          make: result.tags.Make || null,
          model: result.tags.Model || null,
          orientation: result.tags.Orientation || null,
          width: result.imageSize ? result.imageSize.width : null,
          height: result.imageSize ? result.imageSize.height : null
        };
      }
      return null;
    } catch (error) {
      console.log('⚠️ Impossible d\'extraire les métadonnées EXIF:', error.message);
      return null;
    }
  }

  // Compress and resize image
  static async compressImage(inputPath, outputPath, options = {}) {
    try {
      const {
        width = 1920,
        height = 1080,
        quality = 80,
        format = 'jpeg'
      } = options;

      await sharp(inputPath)
        .resize(width, height, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality })
        .toFile(outputPath);

      const stats = fs.statSync(outputPath);
      console.log(`✅ Image compressée: ${(stats.size / 1024).toFixed(2)} KB`);
      
      return {
        path: outputPath,
        size: stats.size,
        width,
        height
      };
    } catch (error) {
      console.error('❌ Erreur compression image:', error);
      throw error;
    }
  }

  // Generate thumbnail
  static async generateThumbnail(inputPath, outputPath, size = 300) {
    try {
      await sharp(inputPath)
        .resize(size, size, { fit: 'cover' })
        .jpeg({ quality: 70 })
        .toFile(outputPath);

      console.log(`✅ Miniature générée: ${size}x${size}`);
      return outputPath;
    } catch (error) {
      console.error('❌ Erreur génération miniature:', error);
      throw error;
    }
  }

  // Create organized folder structure
  static createOrganizedFolders(basePath, date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    const folders = {
      year: path.join(basePath, String(year)),
      month: path.join(basePath, String(year), month),
      day: path.join(basePath, String(year), month, day)
    };

    // Create folders if they don't exist
    Object.values(folders).forEach(folder => {
      if (!fs.existsSync(folder)) {
        fs.mkdirSync(folder, { recursive: true });
      }
    });

    return folders;
  }

  // Generate unique filename
  static generateUniqueFilename(originalName, userId, timestamp) {
    const ext = path.extname(originalName);
    const baseName = path.basename(originalName, ext);
    const date = moment(timestamp).format('YYYY-MM-DD_HH-mm-ss');
    return `${userId}_${baseName}_${date}${ext}`;
  }

  // Validate GPS coordinates
  static validateGPS(latitude, longitude) {
    if (typeof latitude !== 'number' || typeof longitude !== 'number') {
      return false;
    }
    
    if (latitude < -90 || latitude > 90) {
      return false;
    }
    
    if (longitude < -180 || longitude > 180) {
      return false;
    }
    
    return true;
  }

  // Calculate distance between two GPS points (Haversine formula)
  static calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in kilometers
    const dLat = this.deg2rad(lat2 - lat1);
    const dLon = this.deg2rad(lon2 - lon1);
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(this.deg2rad(lat1)) * Math.cos(this.deg2rad(lat2)) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distance = R * c; // Distance in kilometers
    return distance;
  }

  // Convert degrees to radians
  static deg2rad(deg) {
    return deg * (Math.PI/180);
  }

  // Format timestamp for display
  static formatTimestamp(timestamp, format = 'DD/MM/YYYY HH:mm:ss') {
    if (!timestamp) return 'N/A';
    
    if (timestamp.toDate) {
      // Firestore timestamp
      return moment(timestamp.toDate()).format(format);
    } else if (timestamp instanceof Date) {
      // Date object
      return moment(timestamp).format(format);
    } else if (typeof timestamp === 'number') {
      // Unix timestamp
      return moment(timestamp).format(format);
    } else {
      // String or other
      return moment(timestamp).format(format);
    }
  }

  // Sanitize filename
  static sanitizeFilename(filename) {
    return filename
      .replace(/[^a-zA-Z0-9.-]/g, '_')
      .replace(/_+/g, '_')
      .substring(0, 255);
  }

  // Get file size in human readable format
  static formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  // Check if file is an image
  static isImageFile(filename) {
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'];
    const ext = path.extname(filename).toLowerCase();
    return imageExtensions.includes(ext);
  }

  // Generate random ID
  static generateId(length = 8) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  // Parse location string to coordinates
  static parseLocationString(locationString) {
    try {
      // Try to parse as "lat,lon" format
      const parts = locationString.split(',').map(part => parseFloat(part.trim()));
      if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
        return { latitude: parts[0], longitude: parts[1] };
      }
      return null;
    } catch (error) {
      return null;
    }
  }

  // Validate email format
  static isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  // Sleep function for async operations
  static sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Retry function with exponential backoff
  static async retry(fn, maxRetries = 3, delay = 1000) {
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await fn();
      } catch (error) {
        if (i === maxRetries - 1) throw error;
        
        const waitTime = delay * Math.pow(2, i);
        console.log(`⚠️ Tentative ${i + 1} échouée, nouvelle tentative dans ${waitTime}ms...`);
        await this.sleep(waitTime);
      }
    }
  }
}

module.exports = Utils; 