import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { ObjectStorageService, ObjectNotFoundError } from "./objectStorage";
import { insertStorySchema, insertDraftSchema, insertLikeSchema, insertChapterSchema } from "@shared/schema";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  await setupAuth(app);

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  app.patch('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { firstName, lastName, username, bio, profileImageUrl } = req.body;
      
      const updatedUser = await storage.updateUser(userId, {
        firstName,
        lastName,
        username: username || null,
        bio: bio || null,
        profileImageUrl: profileImageUrl || null,
      });
      
      res.json(updatedUser);
    } catch (error) {
      console.error("Error updating user:", error);
      res.status(500).json({ message: "Failed to update user" });
    }
  });

  // Story routes
  app.get('/api/stories', async (req, res) => {
    try {
      const { category, sortBy } = req.query;
      const stories = await storage.getPublishedStories(
        category as string,
        sortBy as string
      );
      res.json(stories);
    } catch (error) {
      console.error("Error fetching stories:", error);
      res.status(500).json({ message: "Failed to fetch stories" });
    }
  });

  app.get('/api/stories/:category/:sortBy', async (req, res) => {
    try {
      const { category, sortBy } = req.params;
      const stories = await storage.getPublishedStories(category, sortBy);
      res.json(stories);
    } catch (error) {
      console.error("Error fetching stories:", error);
      res.status(500).json({ message: "Failed to fetch stories" });
    }
  });

  app.get('/api/stories/:id', async (req, res) => {
    try {
      const story = await storage.getStory(req.params.id);
      if (!story || !story.published) {
        return res.status(404).json({ message: "Story not found" });
      }
      res.json(story);
    } catch (error) {
      console.error("Error fetching story:", error);
      res.status(500).json({ message: "Failed to fetch story" });
    }
  });

  app.post('/api/stories', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const storyData = insertStorySchema.parse({
        ...req.body,
        authorId: userId,
      });
      
      const story = await storage.createStory(storyData);
      res.status(201).json(story);
    } catch (error) {
      console.error("Error creating story:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid story data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create story" });
    }
  });

  app.put('/api/stories/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const story = await storage.getStory(req.params.id);
      
      if (!story || story.authorId !== userId) {
        return res.status(404).json({ message: "Story not found" });
      }

      const updates = insertStorySchema.partial().parse(req.body);
      const updatedStory = await storage.updateStory(req.params.id, updates);
      res.json(updatedStory);
    } catch (error) {
      console.error("Error updating story:", error);
      res.status(500).json({ message: "Failed to update story" });
    }
  });

  app.post('/api/stories/:id/publish', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const story = await storage.getStory(req.params.id);
      
      if (!story || story.authorId !== userId) {
        return res.status(404).json({ message: "Story not found" });
      }

      const publishedStory = await storage.publishStory(req.params.id);
      res.json(publishedStory);
    } catch (error) {
      console.error("Error publishing story:", error);
      res.status(500).json({ message: "Failed to publish story" });
    }
  });

  // Enable chapters on a story
  app.put('/api/stories/:id/enable-chapters', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.claims.sub;

      // Verify the user owns this story
      const story = await storage.getStory(id);
      if (!story) {
        return res.status(404).json({ message: "Story not found" });
      }
      if (story.authorId !== userId) {
        return res.status(403).json({ message: "Not authorized to modify this story" });
      }

      // Enable chapters on the story
      await storage.enableChaptersOnStory(id);
      
      res.json({ message: "Chapters enabled successfully" });
    } catch (error) {
      console.error("Error enabling chapters:", error);
      res.status(500).json({ message: "Failed to enable chapters" });
    }
  });

  // Draft routes
  app.get('/api/drafts', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const drafts = await storage.getDraftsByAuthor(userId);
      res.json(drafts);
    } catch (error) {
      console.error("Error fetching drafts:", error);
      res.status(500).json({ message: "Failed to fetch drafts" });
    }
  });

  app.get('/api/drafts/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const draft = await storage.getDraft(req.params.id);
      
      if (!draft || draft.authorId !== userId) {
        return res.status(404).json({ message: "Draft not found" });
      }
      
      res.json(draft);
    } catch (error) {
      console.error("Error fetching draft:", error);
      res.status(500).json({ message: "Failed to fetch draft" });
    }
  });

  app.post('/api/drafts', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const draftData = insertDraftSchema.parse({
        ...req.body,
        authorId: userId,
      });
      
      const draft = await storage.createDraft(draftData);
      res.status(201).json(draft);
    } catch (error) {
      console.error("Error creating draft:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid draft data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create draft" });
    }
  });

  app.put('/api/drafts/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const draft = await storage.getDraft(req.params.id);
      
      if (!draft || draft.authorId !== userId) {
        return res.status(404).json({ message: "Draft not found" });
      }

      const updates = insertDraftSchema.partial().parse(req.body);
      const updatedDraft = await storage.updateDraft(req.params.id, updates);
      res.json(updatedDraft);
    } catch (error) {
      console.error("Error updating draft:", error);
      res.status(500).json({ message: "Failed to update draft" });
    }
  });

  app.delete('/api/drafts/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const draft = await storage.getDraft(req.params.id);
      
      if (!draft || draft.authorId !== userId) {
        return res.status(404).json({ message: "Draft not found" });
      }

      await storage.deleteDraft(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting draft:", error);
      res.status(500).json({ message: "Failed to delete draft" });
    }
  });

  // Chapter routes
  app.get('/api/stories/:id/chapters', async (req, res) => {
    try {
      const chapters = await storage.getStoryChapters(req.params.id);
      res.json(chapters);
    } catch (error) {
      console.error("Error fetching chapters:", error);
      res.status(500).json({ message: "Failed to fetch chapters" });
    }
  });

  app.post('/api/stories/:id/chapters', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const story = await storage.getStory(req.params.id);
      
      if (!story || story.authorId !== userId) {
        return res.status(404).json({ message: "Story not found" });
      }

      const chapterData = insertChapterSchema.parse({
        ...req.body,
        storyId: req.params.id,
      });
      
      const chapter = await storage.createChapter(chapterData);
      
      // Update story to indicate it has chapters
      await storage.updateStory(req.params.id, { hasChapters: true });
      
      res.status(201).json(chapter);
    } catch (error) {
      console.error("Error creating chapter:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid chapter data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create chapter" });
    }
  });

  app.get('/api/chapters/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const chapter = await storage.getChapter(req.params.id);
      
      if (!chapter) {
        return res.status(404).json({ message: "Chapter not found" });
      }

      // Allow access if chapter is published OR if user is the author
      const story = await storage.getStory(chapter.storyId);
      const isAuthor = story && story.authorId === userId;
      
      if (!chapter.published && !isAuthor) {
        return res.status(404).json({ message: "Chapter not found" });
      }
      
      res.json(chapter);
    } catch (error) {
      console.error("Error fetching chapter:", error);
      res.status(500).json({ message: "Failed to fetch chapter" });
    }
  });

  app.put('/api/chapters/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const chapter = await storage.getChapter(req.params.id);
      
      if (!chapter) {
        return res.status(404).json({ message: "Chapter not found" });
      }

      // Check if user owns the story
      const story = await storage.getStory(chapter.storyId);
      if (!story || story.authorId !== userId) {
        return res.status(403).json({ message: "Not authorized" });
      }

      const updates = insertChapterSchema.partial().parse(req.body);
      const updatedChapter = await storage.updateChapter(req.params.id, updates);
      res.json(updatedChapter);
    } catch (error) {
      console.error("Error updating chapter:", error);
      res.status(500).json({ message: "Failed to update chapter" });
    }
  });

  app.delete('/api/chapters/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const chapter = await storage.getChapter(req.params.id);
      
      if (!chapter) {
        return res.status(404).json({ message: "Chapter not found" });
      }

      // Check if user owns the story
      const story = await storage.getStory(chapter.storyId);
      if (!story || story.authorId !== userId) {
        return res.status(403).json({ message: "Not authorized" });
      }

      await storage.deleteChapter(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting chapter:", error);
      res.status(500).json({ message: "Failed to delete chapter" });
    }
  });

  app.post('/api/chapters/:id/publish', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const chapter = await storage.getChapter(req.params.id);
      
      if (!chapter) {
        return res.status(404).json({ message: "Chapter not found" });
      }

      // Check if user owns the story
      const story = await storage.getStory(chapter.storyId);
      if (!story || story.authorId !== userId) {
        return res.status(403).json({ message: "Not authorized" });
      }

      const publishedChapter = await storage.publishChapter(req.params.id);
      res.json(publishedChapter);
    } catch (error) {
      console.error("Error publishing chapter:", error);
      res.status(500).json({ message: "Failed to publish chapter" });
    }
  });

  // Like routes
  app.post('/api/stories/:id/like', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const storyId = req.params.id;
      
      const result = await storage.toggleLike(userId, storyId);
      res.json(result);
    } catch (error) {
      console.error("Error toggling like:", error);
      res.status(500).json({ message: "Failed to toggle like" });
    }
  });

  app.get('/api/stories/:id/likes', async (req, res) => {
    try {
      const count = await storage.getLikeCount(req.params.id);
      res.json({ count });
    } catch (error) {
      console.error("Error fetching like count:", error);
      res.status(500).json({ message: "Failed to fetch like count" });
    }
  });

  app.get('/api/user/likes', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const likes = await storage.getUserLikes(userId);
      res.json(likes);
    } catch (error) {
      console.error("Error fetching user likes:", error);
      res.status(500).json({ message: "Failed to fetch user likes" });
    }
  });

  app.get('/api/user/liked-stories', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const likedStories = await storage.getUserLikedStories(userId);
      res.json(likedStories);
    } catch (error) {
      console.error("Error fetching user liked stories:", error);
      res.status(500).json({ message: "Failed to fetch user liked stories" });
    }
  });

  // Highlight routes
  app.post('/api/highlights', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { storyId, chapterId, selectedText, startOffset, endOffset, color, note } = req.body;
      
      const highlight = await storage.createHighlight({
        userId,
        storyId,
        chapterId,
        selectedText,
        startOffset,
        endOffset,
        color,
        note,
      });
      
      res.json(highlight);
    } catch (error) {
      console.error("Error creating highlight:", error);
      res.status(500).json({ message: "Failed to create highlight" });
    }
  });

  app.get('/api/stories/:storyId/highlights', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { storyId } = req.params;
      const highlights = await storage.getStoryHighlights(storyId, userId);
      res.json(highlights);
    } catch (error) {
      console.error("Error fetching highlights:", error);
      res.status(500).json({ message: "Failed to fetch highlights" });
    }
  });

  app.delete('/api/highlights/:id', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      await storage.deleteHighlight(id);
      res.json({ message: "Highlight deleted" });
    } catch (error) {
      console.error("Error deleting highlight:", error);
      res.status(500).json({ message: "Failed to delete highlight" });
    }
  });

  // Bookmark routes
  app.post('/api/bookmarks', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { storyId, note } = req.body;
      
      const bookmark = await storage.createBookmark({
        userId,
        storyId,
        position: 0, // Not used for story bookmarks
        note,
      });
      
      res.json(bookmark);
    } catch (error) {
      console.error("Error creating bookmark:", error);
      res.status(500).json({ message: "Failed to create bookmark" });
    }
  });

  app.get('/api/user/bookmarks', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const bookmarks = await storage.getUserBookmarks(userId);
      res.json(bookmarks);
    } catch (error) {
      console.error("Error fetching bookmarks:", error);
      res.status(500).json({ message: "Failed to fetch bookmarks" });
    }
  });

  app.delete('/api/bookmarks/:id', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      await storage.deleteBookmark(id);
      res.json({ message: "Bookmark deleted" });
    } catch (error) {
      console.error("Error deleting bookmark:", error);
      res.status(500).json({ message: "Failed to delete bookmark" });
    }
  });

  // Quote routes
  app.post('/api/quotes', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { storyId, chapterId, quoteText, isPublic } = req.body;
      
      const quote = await storage.createQuote({
        userId,
        storyId,
        chapterId,
        quoteText,
        isPublic,
      });
      
      res.json(quote);
    } catch (error) {
      console.error("Error creating quote:", error);
      res.status(500).json({ message: "Failed to create quote" });
    }
  });

  app.get('/api/user/quotes', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const quotes = await storage.getUserQuotes(userId);
      res.json(quotes);
    } catch (error) {
      console.error("Error fetching user quotes:", error);
      res.status(500).json({ message: "Failed to fetch quotes" });
    }
  });

  app.get('/api/user/bookmarks', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const bookmarks = await storage.getUserBookmarks(userId);
      res.json(bookmarks);
    } catch (error) {
      console.error("Error fetching user bookmarks:", error);
      res.status(500).json({ message: "Failed to fetch bookmarks" });
    }
  });

  app.get('/api/stories/:storyId/highlights', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { storyId } = req.params;
      const highlights = await storage.getStoryHighlights(storyId, userId);
      res.json(highlights);
    } catch (error) {
      console.error("Error fetching highlights:", error);
      res.status(500).json({ message: "Failed to fetch highlights" });
    }
  });

  app.get('/api/user/quotes', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const quotes = await storage.getUserQuotes(userId);
      res.json(quotes);
    } catch (error) {
      console.error("Error fetching user quotes:", error);
      res.status(500).json({ message: "Failed to fetch user quotes" });
    }
  });

  app.get('/api/quotes/public', async (req, res) => {
    try {
      const quotes = await storage.getPublicQuotes();
      res.json(quotes);
    } catch (error) {
      console.error("Error fetching public quotes:", error);
      res.status(500).json({ message: "Failed to fetch public quotes" });
    }
  });

  app.delete('/api/quotes/:id', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      await storage.deleteQuote(id);
      res.json({ message: "Quote deleted" });
    } catch (error) {
      console.error("Error deleting quote:", error);
      res.status(500).json({ message: "Failed to delete quote" });
    }
  });

  // User routes
  app.get('/api/users/:id/stories', async (req, res) => {
    try {
      const stories = await storage.getStoriesByAuthor(req.params.id);
      res.json(stories);
    } catch (error) {
      console.error("Error fetching user stories:", error);
      res.status(500).json({ message: "Failed to fetch user stories" });
    }
  });

  app.put('/api/user/profile', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { bio, username } = req.body;
      
      const currentUser = await storage.getUser(userId);
      if (!currentUser) {
        return res.status(404).json({ message: "User not found" });
      }

      const updatedUser = await storage.upsertUser({
        ...currentUser,
        bio,
        username,
      });
      
      res.json(updatedUser);
    } catch (error) {
      console.error("Error updating profile:", error);
      res.status(500).json({ message: "Failed to update profile" });
    }
  });

  // Notification routes
  app.get('/api/notifications', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const notifications = await storage.getUserNotifications(userId);
      res.json(notifications);
    } catch (error) {
      console.error("Error fetching notifications:", error);
      res.status(500).json({ message: "Failed to fetch notifications" });
    }
  });

  app.put('/api/notifications/:id/read', isAuthenticated, async (req: any, res) => {
    try {
      await storage.markNotificationRead(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error marking notification as read:", error);
      res.status(500).json({ message: "Failed to mark notification as read" });
    }
  });

  // Object storage routes for cover images
  app.post('/api/objects/upload', isAuthenticated, async (req: any, res) => {
    try {
      const objectStorageService = new ObjectStorageService();
      const uploadURL = await objectStorageService.getObjectEntityUploadURL();
      res.json({ uploadURL });
    } catch (error) {
      console.error("Error getting upload URL:", error);
      res.status(500).json({ message: "Failed to get upload URL" });
    }
  });

  app.put('/api/cover-images', isAuthenticated, async (req: any, res) => {
    try {
      if (!req.body.coverImageURL) {
        return res.status(400).json({ error: "coverImageURL is required" });
      }

      const userId = req.user.claims.sub;
      const objectStorageService = new ObjectStorageService();
      const objectPath = await objectStorageService.trySetObjectEntityAclPolicy(
        req.body.coverImageURL,
        {
          owner: userId,
          visibility: "public", // Cover images should be publicly accessible
        },
      );

      res.status(200).json({
        objectPath: objectPath,
      });
    } catch (error) {
      console.error("Error setting cover image:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Serve public objects (cover images)
  app.get("/public-objects/:filePath(*)", async (req, res) => {
    const filePath = req.params.filePath;
    const objectStorageService = new ObjectStorageService();
    try {
      const file = await objectStorageService.searchPublicObject(filePath);
      if (!file) {
        return res.status(404).json({ error: "File not found" });
      }
      objectStorageService.downloadObject(file, res);
    } catch (error) {
      console.error("Error searching for public object:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // Serve private objects (cover images)
  app.get("/objects/:objectPath(*)", async (req, res) => {
    const objectStorageService = new ObjectStorageService();
    try {
      const objectFile = await objectStorageService.getObjectEntityFile(
        req.path,
      );
      objectStorageService.downloadObject(objectFile, res);
    } catch (error) {
      console.error("Error checking object access:", error);
      if (error instanceof ObjectNotFoundError) {
        return res.sendStatus(404);
      }
      return res.sendStatus(500);
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
