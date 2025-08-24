import {
  users,
  stories,
  drafts,
  likes,
  notifications,
  chapters,
  highlights,
  bookmarks,
  quotes,
  type User,
  type UpsertUser,
  type Story,
  type InsertStory,
  type Draft,
  type InsertDraft,
  type InsertLike,
  type Notification,
  type Chapter,
  type InsertChapter,
  type Highlight,
  type InsertHighlight,
  type Bookmark,
  type InsertBookmark,
  type Quote,
  type InsertQuote,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, sql, and, count, inArray } from "drizzle-orm";

export interface IStorage {
  // User operations (required for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  updateUser(id: string, updates: Partial<UpsertUser>): Promise<User>;
  
  // Story operations
  createStory(story: InsertStory): Promise<Story>;
  getStory(id: string): Promise<Story | undefined>;
  getStoriesByAuthor(authorId: string): Promise<Story[]>;
  getPublishedStories(category?: string, sortBy?: string): Promise<(Story & { author: User; likeCount: number })[]>;
  updateStory(id: string, updates: Partial<InsertStory>): Promise<Story>;
  publishStory(id: string): Promise<Story>;
  
  // Chapter operations
  createChapter(chapter: InsertChapter): Promise<Chapter>;
  getChapter(id: string): Promise<Chapter | undefined>;
  getStoryChapters(storyId: string): Promise<Chapter[]>;
  updateChapter(id: string, updates: Partial<InsertChapter>): Promise<Chapter>;
  deleteChapter(id: string): Promise<void>;
  publishChapter(id: string): Promise<Chapter>;
  
  // Draft operations
  createDraft(draft: InsertDraft): Promise<Draft>;
  getDraft(id: string): Promise<Draft | undefined>;
  getDraftsByAuthor(authorId: string): Promise<Draft[]>;
  updateDraft(id: string, updates: Partial<InsertDraft>): Promise<Draft>;
  deleteDraft(id: string): Promise<void>;
  
  // Like operations
  toggleLike(userId: string, storyId: string): Promise<{ liked: boolean; count: number }>;
  getLikeCount(storyId: string): Promise<number>;
  getUserLikes(userId: string): Promise<string[]>;
  
  // Notification operations
  createNotification(userId: string, type: string, storyId?: string): Promise<Notification>;
  getUserNotifications(userId: string): Promise<Notification[]>;
  markNotificationRead(id: string): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  // User operations (required for Replit Auth)
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  async updateUser(id: string, updates: Partial<UpsertUser>): Promise<User> {
    const [user] = await db
      .update(users)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  // Story operations
  async createStory(story: InsertStory): Promise<Story> {
    const [newStory] = await db.insert(stories).values(story).returning();
    return newStory;
  }

  async getStory(id: string): Promise<Story | undefined> {
    const [story] = await db.select().from(stories).where(eq(stories.id, id));
    return story;
  }

  async getStoriesByAuthor(authorId: string): Promise<Story[]> {
    return db
      .select()
      .from(stories)
      .where(and(eq(stories.authorId, authorId), eq(stories.published, true)))
      .orderBy(desc(stories.publishedAt));
  }

  async getPublishedStories(category?: string, sortBy?: string): Promise<(Story & { author: User; likeCount: number })[]> {
    let baseQuery = db
      .select({
        id: stories.id,
        title: stories.title,
        content: stories.content,
        excerpt: stories.excerpt,
        category: stories.category,
        coverImageUrl: stories.coverImageUrl,
        authorId: stories.authorId,
        published: stories.published,
        publishedAt: stories.publishedAt,
        wordCount: stories.wordCount,
        createdAt: stories.createdAt,
        updatedAt: stories.updatedAt,
        author: {
          id: users.id,
          email: users.email,
          firstName: users.firstName,
          lastName: users.lastName,
          profileImageUrl: users.profileImageUrl,
          bio: users.bio,
          username: users.username,
          createdAt: users.createdAt,
          updatedAt: users.updatedAt,
        },
        likeCount: count(likes.id),
      })
      .from(stories)
      .leftJoin(users, eq(stories.authorId, users.id))
      .leftJoin(likes, eq(stories.id, likes.storyId))
      .groupBy(stories.id, users.id);

    // Apply filters and get results
    let query = baseQuery.where(eq(stories.published, true));
    
    if (category && category !== 'all') {
      query = query.where(eq(stories.category, category));
    }

    // Apply sorting
    if (sortBy === 'recent') {
      query = query.orderBy(desc(stories.publishedAt));
    } else if (sortBy === 'trending') {
      query = query.orderBy(desc(count(likes.id)), desc(stories.publishedAt));
    } else {
      query = query.orderBy(desc(count(likes.id)), desc(stories.publishedAt));
    }

    const results = await query.limit(50);
    return results as (Story & { author: User; likeCount: number })[];
  }

  async updateStory(id: string, updates: Partial<InsertStory>): Promise<Story> {
    const [story] = await db
      .update(stories)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(stories.id, id))
      .returning();
    return story;
  }

  async publishStory(id: string): Promise<Story> {
    const [story] = await db
      .update(stories)
      .set({ 
        published: true, 
        publishedAt: new Date(),
        updatedAt: new Date() 
      })
      .where(eq(stories.id, id))
      .returning();
    return story;
  }

  async enableChaptersOnStory(id: string): Promise<Story> {
    const [story] = await db
      .update(stories)
      .set({ 
        hasChapters: true,
        updatedAt: new Date() 
      })
      .where(eq(stories.id, id))
      .returning();
    return story;
  }

  // Draft operations
  async createDraft(draft: InsertDraft): Promise<Draft> {
    const [newDraft] = await db.insert(drafts).values(draft).returning();
    return newDraft;
  }

  async getDraft(id: string): Promise<Draft | undefined> {
    const [draft] = await db.select().from(drafts).where(eq(drafts.id, id));
    return draft;
  }

  async getDraftsByAuthor(authorId: string): Promise<Draft[]> {
    return db
      .select()
      .from(drafts)
      .where(eq(drafts.authorId, authorId))
      .orderBy(desc(drafts.updatedAt));
  }

  async updateDraft(id: string, updates: Partial<InsertDraft>): Promise<Draft> {
    const [draft] = await db
      .update(drafts)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(drafts.id, id))
      .returning();
    return draft;
  }

  async deleteDraft(id: string): Promise<void> {
    await db.delete(drafts).where(eq(drafts.id, id));
  }

  // Like operations
  async toggleLike(userId: string, storyId: string): Promise<{ liked: boolean; count: number }> {
    const existingLike = await db
      .select()
      .from(likes)
      .where(and(eq(likes.userId, userId), eq(likes.storyId, storyId)))
      .limit(1);

    if (existingLike.length > 0) {
      // Unlike
      await db
        .delete(likes)
        .where(and(eq(likes.userId, userId), eq(likes.storyId, storyId)));
      
      const count = await this.getLikeCount(storyId);
      return { liked: false, count };
    } else {
      // Like
      await db.insert(likes).values({ userId, storyId });
      
      // Create notification for story author
      const story = await this.getStory(storyId);
      if (story && story.authorId !== userId) {
        await this.createNotification(story.authorId, 'like', storyId);
      }
      
      const count = await this.getLikeCount(storyId);
      return { liked: true, count };
    }
  }

  async getLikeCount(storyId: string): Promise<number> {
    const [result] = await db
      .select({ count: count() })
      .from(likes)
      .where(eq(likes.storyId, storyId));
    return result?.count || 0;
  }

  async getUserLikes(userId: string): Promise<string[]> {
    const userLikes = await db
      .select({ storyId: likes.storyId })
      .from(likes)
      .where(eq(likes.userId, userId));
    return userLikes.map(like => like.storyId);
  }

  async getUserLikedStories(userId: string): Promise<(Story & { author: User; likeCount: number })[]> {
    const likedStoryIds = await this.getUserLikes(userId);
    
    if (likedStoryIds.length === 0) {
      return [];
    }

    const likedStories = await db
      .select({
        id: stories.id,
        title: stories.title,
        content: stories.content,
        excerpt: stories.excerpt,
        category: stories.category,
        coverImageUrl: stories.coverImageUrl,
        authorId: stories.authorId,
        published: stories.published,
        publishedAt: stories.publishedAt,
        wordCount: stories.wordCount,
        createdAt: stories.createdAt,
        updatedAt: stories.updatedAt,
        author: {
          id: users.id,
          email: users.email,
          firstName: users.firstName,
          lastName: users.lastName,
          profileImageUrl: users.profileImageUrl,
          bio: users.bio,
          username: users.username,
          createdAt: users.createdAt,
          updatedAt: users.updatedAt,
        },
        likeCount: count(likes.id),
      })
      .from(stories)
      .leftJoin(users, eq(stories.authorId, users.id))
      .leftJoin(likes, eq(stories.id, likes.storyId))
      .where(and(
        inArray(stories.id, likedStoryIds),
        eq(stories.published, true)
      ))
      .groupBy(stories.id, users.id)
      .orderBy(desc(stories.publishedAt));

    return likedStories as (Story & { author: User; likeCount: number })[];
  }

  // Chapter operations
  async createChapter(chapter: InsertChapter): Promise<Chapter> {
    const [newChapter] = await db.insert(chapters).values(chapter).returning();
    return newChapter;
  }

  async getChapter(id: string): Promise<Chapter | undefined> {
    const [chapter] = await db.select().from(chapters).where(eq(chapters.id, id));
    return chapter;
  }

  async getStoryChapters(storyId: string): Promise<Chapter[]> {
    return db
      .select()
      .from(chapters)
      .where(eq(chapters.storyId, storyId))
      .orderBy(chapters.chapterNumber);
  }

  async updateChapter(id: string, updates: Partial<InsertChapter>): Promise<Chapter> {
    const [chapter] = await db
      .update(chapters)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(chapters.id, id))
      .returning();
    return chapter;
  }

  async deleteChapter(id: string): Promise<void> {
    await db.delete(chapters).where(eq(chapters.id, id));
  }

  async publishChapter(id: string): Promise<Chapter> {
    const [chapter] = await db
      .update(chapters)
      .set({ 
        published: true, 
        publishedAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(chapters.id, id))
      .returning();
    return chapter;
  }

  // Notification operations
  async createNotification(userId: string, type: string, storyId?: string): Promise<Notification> {
    const [notification] = await db
      .insert(notifications)
      .values({ userId, type, storyId })
      .returning();
    return notification;
  }

  async getUserNotifications(userId: string): Promise<Notification[]> {
    return db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt))
      .limit(20);
  }

  async markNotificationRead(id: string): Promise<void> {
    await db
      .update(notifications)
      .set({ read: true })
      .where(eq(notifications.id, id));
  }

  // Reader engagement operations
  async createHighlight(highlight: InsertHighlight): Promise<Highlight> {
    const [newHighlight] = await db.insert(highlights).values(highlight).returning();
    return newHighlight;
  }

  async getStoryHighlights(storyId: string, userId: string): Promise<Highlight[]> {
    return db
      .select()
      .from(highlights)
      .where(and(eq(highlights.storyId, storyId), eq(highlights.userId, userId)))
      .orderBy(highlights.startOffset);
  }

  async deleteHighlight(id: string): Promise<void> {
    await db.delete(highlights).where(eq(highlights.id, id));
  }

  async createBookmark(bookmark: InsertBookmark): Promise<Bookmark> {
    // Check if bookmark already exists for this user and story
    const existingBookmark = await db
      .select()
      .from(bookmarks)
      .where(and(eq(bookmarks.userId, bookmark.userId), eq(bookmarks.storyId, bookmark.storyId)))
      .limit(1);
    
    if (existingBookmark.length > 0) {
      // Update existing bookmark
      const [updatedBookmark] = await db
        .update(bookmarks)
        .set({ note: bookmark.note, createdAt: new Date() })
        .where(eq(bookmarks.id, existingBookmark[0].id))
        .returning();
      return updatedBookmark;
    }
    
    const [newBookmark] = await db.insert(bookmarks).values(bookmark).returning();
    return newBookmark;
  }

  async getUserBookmarks(userId: string): Promise<(Bookmark & { story: Story })[]> {
    return db
      .select({
        id: bookmarks.id,
        userId: bookmarks.userId,
        storyId: bookmarks.storyId,
        chapterId: bookmarks.chapterId,
        position: bookmarks.position,
        note: bookmarks.note,
        createdAt: bookmarks.createdAt,
        story: {
          id: stories.id,
          title: stories.title,
          content: stories.content,
          excerpt: stories.excerpt,
          category: stories.category,
          coverImageUrl: stories.coverImageUrl,
          authorId: stories.authorId,
          published: stories.published,
          publishedAt: stories.publishedAt,
          wordCount: stories.wordCount,
          createdAt: stories.createdAt,
          updatedAt: stories.updatedAt,
        },
      })
      .from(bookmarks)
      .leftJoin(stories, eq(bookmarks.storyId, stories.id))
      .where(eq(bookmarks.userId, userId))
      .orderBy(desc(bookmarks.createdAt)) as (Bookmark & { story: Story })[];
  }

  async deleteBookmark(id: string): Promise<void> {
    await db.delete(bookmarks).where(eq(bookmarks.id, id));
  }

  async createQuote(quote: InsertQuote): Promise<Quote> {
    const [newQuote] = await db.insert(quotes).values(quote).returning();
    return newQuote;
  }

  async getUserQuotes(userId: string): Promise<(Quote & { story: Story })[]> {
    return db
      .select({
        id: quotes.id,
        userId: quotes.userId,
        storyId: quotes.storyId,
        chapterId: quotes.chapterId,
        quoteText: quotes.quoteText,
        isPublic: quotes.isPublic,
        createdAt: quotes.createdAt,
        story: {
          id: stories.id,
          title: stories.title,
          content: stories.content,
          excerpt: stories.excerpt,
          category: stories.category,
          coverImageUrl: stories.coverImageUrl,
          authorId: stories.authorId,
          published: stories.published,
          publishedAt: stories.publishedAt,
          wordCount: stories.wordCount,
          createdAt: stories.createdAt,
          updatedAt: stories.updatedAt,
        },
      })
      .from(quotes)
      .leftJoin(stories, eq(quotes.storyId, stories.id))
      .where(eq(quotes.userId, userId))
      .orderBy(desc(quotes.createdAt)) as (Quote & { story: Story })[];
  }

  async getPublicQuotes(): Promise<(Quote & { story: Story; user: User })[]> {
    return db
      .select({
        id: quotes.id,
        userId: quotes.userId,
        storyId: quotes.storyId,
        chapterId: quotes.chapterId,
        quoteText: quotes.quoteText,
        isPublic: quotes.isPublic,
        createdAt: quotes.createdAt,
        story: {
          id: stories.id,
          title: stories.title,
          content: stories.content,
          excerpt: stories.excerpt,
          category: stories.category,
          coverImageUrl: stories.coverImageUrl,
          authorId: stories.authorId,
          published: stories.published,
          publishedAt: stories.publishedAt,
          wordCount: stories.wordCount,
          createdAt: stories.createdAt,
          updatedAt: stories.updatedAt,
        },
        user: {
          id: users.id,
          email: users.email,
          firstName: users.firstName,
          lastName: users.lastName,
          profileImageUrl: users.profileImageUrl,
          bio: users.bio,
          username: users.username,
          createdAt: users.createdAt,
          updatedAt: users.updatedAt,
        },
      })
      .from(quotes)
      .leftJoin(stories, eq(quotes.storyId, stories.id))
      .leftJoin(users, eq(quotes.userId, users.id))
      .where(eq(quotes.isPublic, true))
      .orderBy(desc(quotes.createdAt)) as (Quote & { story: Story; user: User })[];
  }

  async deleteQuote(id: string): Promise<void> {
    await db.delete(quotes).where(eq(quotes.id, id));
  }
}

export const storage = new DatabaseStorage();
