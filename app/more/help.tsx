import React, { useState, useEffect } from 'react';
import { StyleSheet, View, ScrollView, Text, TouchableOpacity, TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius } from '@/constants/tokens';
import { PageHeader } from '@/components/PageHeader';
import { seedDatabase } from '@/lib/mockSeed';
import { getFAQArticles } from '@/lib/mockDb';
import { FAQArticle } from '@/types/support';

function FAQItem({ article, isExpanded, onToggle }: { article: FAQArticle; isExpanded: boolean; onToggle: () => void }) {
  return (
    <TouchableOpacity style={styles.faqItem} onPress={onToggle} activeOpacity={0.7}>
      <View style={styles.faqHeader}>
        <View style={styles.faqQuestion}>
          <Text style={styles.questionText}>{article.question}</Text>
          <View style={styles.categoryBadge}>
            <Text style={styles.categoryText}>{article.category}</Text>
          </View>
        </View>
        <Ionicons 
          name={isExpanded ? 'chevron-up' : 'chevron-down'} 
          size={20} 
          color={Colors.text.muted} 
        />
      </View>
      {isExpanded && (
        <View style={styles.faqAnswer}>
          <Text style={styles.answerText}>{article.answer}</Text>
          <View style={styles.helpfulRow}>
            <Text style={styles.helpfulText}>Was this helpful?</Text>
            <View style={styles.helpfulButtons}>
              <TouchableOpacity style={styles.helpfulButton}>
                <Ionicons name="thumbs-up" size={16} color={Colors.accent.cyan} />
                <Text style={styles.helpfulCount}>{article.helpful}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.helpfulButton}>
                <Ionicons name="thumbs-down" size={16} color={Colors.text.muted} />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </TouchableOpacity>
  );
}

export default function HelpScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = insets.top + 60;

  const [loading, setLoading] = useState(true);
  const [articles, setArticles] = useState<FAQArticle[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    seedDatabase();
    const timer = setTimeout(() => {
      setArticles(getFAQArticles());
      setLoading(false);
    }, 700);
    return () => clearTimeout(timer);
  }, []);

  const filteredArticles = articles.filter(a => 
    a.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
    a.answer.toLowerCase().includes(searchQuery.toLowerCase()) ||
    a.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const categories = [...new Set(articles.map(a => a.category))];

  return (
    <View style={styles.container}>
      <PageHeader title="Help Center" showBackButton />
      
      <ScrollView style={[styles.scrollView, { paddingTop: headerHeight }]} contentContainerStyle={styles.scrollContent}>
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color={Colors.text.muted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search help articles..."
            placeholderTextColor={Colors.text.muted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        <View style={styles.categoriesRow}>
          {categories.map((category) => (
            <TouchableOpacity 
              key={category} 
              style={styles.categoryChip}
              onPress={() => setSearchQuery(category)}
            >
              <Text style={styles.categoryChipText}>{category}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.resultsCount}>{filteredArticles.length} articles</Text>

        {filteredArticles.map((article) => (
          <FAQItem 
            key={article.id} 
            article={article} 
            isExpanded={expandedId === article.id}
            onToggle={() => setExpandedId(expandedId === article.id ? null : article.id)}
          />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background.primary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.lg,
    paddingBottom: 100,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background.secondary,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border.default,
  },
  searchInput: {
    flex: 1,
    ...Typography.body,
    color: Colors.text.primary,
    marginLeft: Spacing.sm,
    paddingVertical: Spacing.sm,
  },
  categoriesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: Spacing.md,
  },
  categoryChip: {
    backgroundColor: Colors.background.tertiary,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    marginRight: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  categoryChipText: {
    ...Typography.small,
    color: Colors.text.secondary,
  },
  resultsCount: {
    ...Typography.small,
    color: Colors.text.muted,
    marginBottom: Spacing.md,
  },
  faqItem: {
    backgroundColor: Colors.background.secondary,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border.default,
  },
  faqHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  faqQuestion: {
    flex: 1,
    marginRight: Spacing.md,
  },
  questionText: {
    ...Typography.body,
    color: Colors.text.primary,
    fontWeight: '600',
    marginBottom: Spacing.xs,
  },
  categoryBadge: {
    backgroundColor: Colors.background.tertiary,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
    alignSelf: 'flex-start',
  },
  categoryText: {
    ...Typography.micro,
    color: Colors.text.muted,
  },
  faqAnswer: {
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border.subtle,
  },
  answerText: {
    ...Typography.body,
    color: Colors.text.secondary,
    lineHeight: 24,
  },
  helpfulRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border.subtle,
  },
  helpfulText: {
    ...Typography.small,
    color: Colors.text.muted,
  },
  helpfulButtons: {
    flexDirection: 'row',
  },
  helpfulButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: Spacing.md,
  },
  helpfulCount: {
    ...Typography.small,
    color: Colors.accent.cyan,
    marginLeft: 4,
  },
});
