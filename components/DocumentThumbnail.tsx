import React from 'react';
import { View, StyleSheet, ImageBackground } from 'react-native';
import { Colors, BorderRadius } from '@/constants/tokens';

interface DocumentThumbnailProps {
  type: 'invoice' | 'contract' | 'report' | 'email' | 'document' | 'recording';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  variant?: number;
  context?: 'todayplan' | 'authorityqueue' | 'conference' | 'financehub';
}

const invoiceImage = require('@/assets/images/documents/invoice-alpha.webp');
const invoiceOrangeImage = require('@/assets/images/documents/invoice-orange.png');
const ndaImage = require('@/assets/images/documents/nda-photo.jpg');
const vendorContractImage = require('@/assets/images/documents/vendor-contract.png');
const recordingImage = require('@/assets/images/documents/recording-thumbnail.jpg');

const invoiceConfImage = require('@/assets/images/documents/invoice-conf.png');
const ndaConfImage = require('@/assets/images/documents/nda-conf.png');
const reportConfImage = require('@/assets/images/documents/report-q4-conf.png');
const proposalConfImage = require('@/assets/images/documents/proposal-conf.png');

const invoiceBlue1 = require('@/assets/images/documents/invoice-blue-1.png');
const invoiceBlue2 = require('@/assets/images/documents/invoice-blue-2.png');
const contractBlue1 = require('@/assets/images/documents/contract-blue-1.png');
const contractBlue2 = require('@/assets/images/documents/contract-blue-2.png');

export function DocumentThumbnail({ 
  type, 
  size = 'md',
  variant = 0,
  context = 'authorityqueue'
}: DocumentThumbnailProps) {
  const dimensions = {
    sm: { width: 40, height: 52 },
    md: { width: 56, height: 72 },
    lg: { width: 72, height: 92 },
    xl: { width: 100, height: 130 },
  }[size];

  let imageSource;
  
  if (context === 'financehub') {
    if (type === 'invoice') {
      imageSource = variant % 2 === 0 ? invoiceBlue1 : invoiceBlue2;
    } else if (type === 'contract') {
      imageSource = variant % 2 === 0 ? contractBlue1 : contractBlue2;
    } else if (type === 'report') {
      imageSource = invoiceBlue2;
    } else if (type === 'recording') {
      imageSource = recordingImage;
    } else if (type === 'document') {
      imageSource = contractBlue1;
    } else {
      imageSource = invoiceBlue1;
    }
  } else if (context === 'conference') {
    if (type === 'invoice') {
      imageSource = invoiceConfImage;
    } else if (type === 'contract') {
      imageSource = ndaConfImage;
    } else if (type === 'report') {
      imageSource = reportConfImage;
    } else if (type === 'recording') {
      imageSource = recordingImage;
    } else if (type === 'document') {
      imageSource = proposalConfImage;
    } else {
      imageSource = invoiceConfImage;
    }
  } else if (context === 'todayplan') {
    if (type === 'invoice') {
      imageSource = invoiceOrangeImage;
    } else if (type === 'contract') {
      imageSource = vendorContractImage;
    } else if (type === 'report') {
      imageSource = invoiceOrangeImage;
    } else if (type === 'recording') {
      imageSource = recordingImage;
    } else if (type === 'document') {
      imageSource = vendorContractImage;
    } else {
      imageSource = invoiceOrangeImage;
    }
  } else {
    if (type === 'invoice') {
      imageSource = invoiceImage;
    } else if (type === 'contract') {
      imageSource = ndaImage;
    } else if (type === 'report') {
      imageSource = invoiceImage;
    } else if (type === 'recording') {
      imageSource = recordingImage;
    } else if (type === 'document') {
      imageSource = ndaImage;
    } else {
      imageSource = invoiceImage;
    }
  }

  return (
    <View style={[styles.thumbnail, dimensions]}>
      <ImageBackground
        source={imageSource}
        style={styles.imageBackground}
        imageStyle={styles.image}
        resizeMode="cover"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  thumbnail: {
    borderRadius: BorderRadius.xs,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border.default,
    backgroundColor: '#ffffff',
  },
  imageBackground: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  image: {
    borderRadius: BorderRadius.xs - 1,
  },
});
