import * as faceapi from '@vladmandic/face-api';
import { db } from '@/firebase-config';
import { doc, getDoc, setDoc, Timestamp, updateDoc } from 'firebase/firestore';

export interface FaceEmbedding {
	userId: string;
	embedding: number[];
	capturedAt: Date;
	imageUrl?: string;
}

export interface FaceEmbeddingData {
	userId: string;
	embeddings: Array<{
		embedding: number[];
		capturedAt: Date;
		imageUrl?: string;
	}>;
	createdAt: Date;
	updatedAt: Date;
}

export interface FaceRecognitionResult {
	success: boolean;
	confidence: number;
	userId?: string;
	error?: string;
	needsEnrollment?: boolean;
	matchedEmbeddingIndex?: number;
}

class FaceRecognitionService {
	private modelsLoaded = false;
	private readonly SIMILARITY_THRESHOLD = 0.6; // 75% similarity threshold
	private readonly MODEL_URL = '/models'; // We'll store models in public/models

	async loadModels(): Promise<void> {
		if (this.modelsLoaded) return;

		try {
			await Promise.all([
				faceapi.nets.tinyFaceDetector.loadFromUri(this.MODEL_URL),
				faceapi.nets.faceLandmark68Net.loadFromUri(this.MODEL_URL),
				faceapi.nets.faceRecognitionNet.loadFromUri(this.MODEL_URL),
			]);
			this.modelsLoaded = true;
			console.log('Face recognition models loaded successfully');
		} catch (error) {
			console.error('Error loading face recognition models:', error);
			throw new Error('Failed to load face recognition models');
		}
	}

	async detectFaceAndGetDescriptor(
		imageElement: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement
	): Promise<Float32Array | null> {
		try {
			if (!this.modelsLoaded) {
				await this.loadModels();
			}

			const detection = await faceapi
				.detectSingleFace(imageElement, new faceapi.TinyFaceDetectorOptions())
				.withFaceLandmarks()
				.withFaceDescriptor();

			if (!detection) {
				return null;
			}

			return detection.descriptor;
		} catch (error) {
			console.error('Error detecting face:', error);
			return null;
		}
	}

	calculateSimilarity(descriptor1: Float32Array, descriptor2: number[]): number {
		const desc2Array = new Float32Array(descriptor2);
		const distance = faceapi.euclideanDistance(descriptor1, desc2Array);
		
		// Convert distance to similarity (0-1 range, where 1 is identical)
		// Lower distance means higher similarity
		const similarity = Math.max(0, 1 - distance);
		return similarity;
	}

	async getUserFaceEmbedding(userId: string): Promise<FaceEmbedding | null> {
		try {
			console.log('📥 Fetching face embedding from Firestore for:', userId);
			const embeddingRef = doc(db, 'faceEmbeddings', userId);
			const embeddingSnap = await getDoc(embeddingRef);

			if (!embeddingSnap.exists()) {
				console.log('📭 No face embedding found for user (collection may not exist yet)');
				return null;
			}

			const data = embeddingSnap.data();
			
			// Check if this is new multi-embedding format or old single embedding format
			if (data.embeddings && Array.isArray(data.embeddings)) {
				console.log(`📦 Found ${data.embeddings.length} face embeddings!`);
				// Return the most recent embedding for backward compatibility
				const mostRecent = data.embeddings[data.embeddings.length - 1];
				return {
					userId: data.userId,
					embedding: mostRecent.embedding,
					capturedAt: mostRecent.capturedAt.toDate(),
					imageUrl: mostRecent.imageUrl,
				};
			} else {
				// Old format - single embedding
				console.log('📦 Face embedding found (old format)!');
				return {
					userId: data.userId,
					embedding: data.embedding,
					capturedAt: data.capturedAt.toDate(),
					imageUrl: data.imageUrl,
				};
			}
		} catch (error) {
			console.error('❌ Error getting face embedding:', error);
			// Return null instead of throwing - this allows enrollment to proceed
			return null;
		}
	}

	async getUserFaceEmbeddings(userId: string): Promise<FaceEmbeddingData | null> {
		try {
			console.log('📥 Fetching all face embeddings from Firestore for:', userId);
			const embeddingRef = doc(db, 'faceEmbeddings', userId);
			const embeddingSnap = await getDoc(embeddingRef);

			if (!embeddingSnap.exists()) {
				console.log('📭 No face embeddings found for user');
				return null;
			}

			const data = embeddingSnap.data();
			
			
			// Check if this is new multi-embedding format
			if (data.embeddings && Array.isArray(data.embeddings)) {
				console.log(`📦 Found ${data.embeddings.length} face embeddings!`);
				return {
					userId: data.userId,
					embeddings: data.embeddings.map((emb: any) => ({
						embedding: emb.embedding,
						capturedAt: emb.capturedAt.toDate(),
						imageUrl: emb.imageUrl,
					})),
					createdAt: data.createdAt,
					updatedAt: data.updatedAt,
				};
			} else {
				// Old format - convert to new format
				console.log('📦 Converting old format to new format');
				return {
					userId: data.userId,
					embeddings: [{
						embedding: data.embedding,
						capturedAt: data.capturedAt.toDate(),
						imageUrl: data.imageUrl,
					}],
					createdAt: data.capturedAt,
					updatedAt: data.updatedAt,
				};
			}
		} catch (error) {
			console.error('❌ Error getting face embeddings:', error);
			return null;
		}
	}

	async saveFaceEmbedding(
		userId: string,
		descriptor: Float32Array,
		imageUrl?: string,
		replaceAll: boolean = false
	): Promise<void> {
		try {
			console.log('💾 Saving face embedding to Firestore...');
			const embeddingRef = doc(db, 'faceEmbeddings', userId);
			
			const newEmbedding = {
				embedding: Array.from(descriptor),
				capturedAt: new Date(),
				imageUrl: imageUrl || null,
			};

			if (replaceAll) {
				// Replace all embeddings with this one
				const embeddingData: any = {
					userId,
					embeddings: [newEmbedding],
					createdAt: new Date(),
					updatedAt: new Date(),
				};
				await setDoc(embeddingRef, embeddingData);
				console.log('✅ Face embedding saved (replaced all)! Collection created if needed.');
			} else {
				// Check if document exists
				const docSnap = await getDoc(embeddingRef);
				
				if (docSnap.exists()) {
					// Add to existing embeddings
					const data = docSnap.data();
					const existingEmbeddings = data.embeddings || [
						{
							embedding: data.embedding,
							capturedAt: data.capturedAt,
							imageUrl: data.imageUrl,
						}
					];
					
					// Limit to maximum 5 embeddings
					const updatedEmbeddings = [...existingEmbeddings, newEmbedding];
					if (updatedEmbeddings.length > 5) {
						updatedEmbeddings.shift(); // Remove oldest
					}
					
					await updateDoc(embeddingRef, {
						embeddings: updatedEmbeddings,
						updatedAt: new Date(),
					});
					console.log(`✅ Added embedding! Total: ${updatedEmbeddings.length}/5`);
				} else {
					// Create new document
					const embeddingData: any = {
						userId,
						embeddings: [newEmbedding],
						createdAt: new Date(),
						updatedAt: new Date(),
					};
					await setDoc(embeddingRef, embeddingData);
					console.log('✅ First face embedding saved! Collection created.');
				}
			}

			console.log('📍 Location: faceEmbeddings/' + userId);
		} catch (error) {
			console.error('❌ Error saving face embedding:', error);
			throw error;
		}
	}

	async updateFaceEmbedding(
		userId: string,
		descriptor: Float32Array,
		imageUrl?: string
	): Promise<void> {
		try {
			const embeddingRef = doc(db, 'faceEmbeddings', userId);
			
			await updateDoc(embeddingRef, {
				embedding: Array.from(descriptor),
				capturedAt: new Date(),
				...(imageUrl && { imageUrl }),
			});

			console.log('Face embedding updated successfully for user:', userId);
		} catch (error) {
			console.error('Error updating face embedding:', error);
			throw error;
		}
	}

	async deleteFaceEmbedding(userId: string): Promise<void> {
		try {
			console.log('🗑️ Deleting face embedding for user:', userId);
			const embeddingRef = doc(db, 'faceEmbeddings', userId);
			
			// Delete the document
			const { deleteDoc } = await import('firebase/firestore');
			await deleteDoc(embeddingRef);
			
			console.log('✅ Face embedding deleted successfully for user:', userId);
		} catch (error) {
			console.error('❌ Error deleting face embedding:', error);
			throw error;
		}
	}

	async verifyFace(
		userId: string,
		imageElement: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement
	): Promise<FaceRecognitionResult> {
		try {
			// Get all stored embeddings
			const storedData = await this.getUserFaceEmbeddings(userId);

			if (!storedData || storedData.embeddings.length === 0) {
				return {
					success: false,
					confidence: 0,
					needsEnrollment: true,
					error: 'No face embedding found. Please enroll your face first.',
				};
			}

			// Detect face and get descriptor from live image
			const liveDescriptor = await this.detectFaceAndGetDescriptor(imageElement);

			if (!liveDescriptor) {
				return {
					success: false,
					confidence: 0,
					error: 'No face detected in the image. Please ensure your face is clearly visible.',
				};
			}

			// Calculate similarity against ALL stored embeddings and use the best match
			let bestConfidence = 0;
			let bestMatchIndex = -1;

			storedData.embeddings.forEach((embeddingData, index) => {
				const confidence = this.calculateSimilarity(liveDescriptor, embeddingData.embedding);
				
				console.log(`🔍 Embedding ${index + 1}/${storedData.embeddings.length}: ${(confidence * 100).toFixed(2)}% similarity`);
				
				if (confidence > bestConfidence) {
					bestConfidence = confidence;
					bestMatchIndex = index;
				}
			});

			console.log(`✨ Best match: Embedding ${bestMatchIndex + 1} with ${(bestConfidence * 100).toFixed(2)}% similarity`);

			if (bestConfidence >= this.SIMILARITY_THRESHOLD) {
				return {
					success: true,
					confidence: bestConfidence,
					userId,
					matchedEmbeddingIndex: bestMatchIndex,
				};
			} else {
				return {
					success: false,
					confidence: bestConfidence,
					error: `Face verification failed. Confidence: ${(bestConfidence * 100).toFixed(1)}% (Required: ${this.SIMILARITY_THRESHOLD * 100}%)`,
				};
			}
		} catch (error) {
			console.error('Error verifying face:', error);
			return {
				success: false,
				confidence: 0,
				error: 'An error occurred during face verification.',
			};
		}
	}

	async enrollFace(
		userId: string,
		imageElement: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement,
		imageUrl?: string
	): Promise<{ success: boolean; error?: string }> {
		try {
			const descriptor = await this.detectFaceAndGetDescriptor(imageElement);

			if (!descriptor) {
				return {
					success: false,
					error: 'No face detected in the image. Please ensure your face is clearly visible.',
				};
			}

			await this.saveFaceEmbedding(userId, descriptor, imageUrl);

			return { success: true };
		} catch (error) {
			console.error('Error enrolling face:', error);
			return {
				success: false,
				error: 'An error occurred during face enrollment.',
			};
		}
	}

	async hasEnrollment(userId: string): Promise<boolean> {
		console.log('🔍 Checking enrollment for userId:', userId);
		try {
			const embedding = await this.getUserFaceEmbedding(userId);
			const hasEnrollment = embedding !== null;
			console.log('📋 Enrollment result:', hasEnrollment, embedding ? 'Found embedding' : 'No embedding');
			return hasEnrollment;
		} catch (error) {
			console.error('❌ Error in hasEnrollment:', error);
			return false;
		}
	}
}

export const faceRecognitionService = new FaceRecognitionService();
