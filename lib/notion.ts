import {
  type ExtendedRecordMap,
  type SearchParams,
  type SearchResults
} from 'notion-types'
import { getBlockValue, getPageProperty, mergeRecordMaps } from 'notion-utils'
import pMap from 'p-map'
import pMemoize from 'p-memoize'

import {
  isPreviewImageSupportEnabled,
  navigationLinks,
  navigationStyle
} from './config'
import { getTweetsMap } from './get-tweets'
import { notion } from './notion-api'
import { getPreviewImageMap } from './preview-images'

const getNavigationLinkPages = pMemoize(
  async (): Promise<ExtendedRecordMap[]> => {
    const navigationLinkPageIds = (navigationLinks || [])
      .map((link) => link?.pageId)
      .filter(Boolean)

    if (navigationStyle !== 'default' && navigationLinkPageIds.length) {
      return pMap(
        navigationLinkPageIds,
        async (navigationLinkPageId) =>
          notion.getPage(navigationLinkPageId, {
            chunkLimit: 1,
            fetchMissingBlocks: false,
            fetchCollections: false,
            signFileUrls: false
          }),
        {
          concurrency: 4
        }
      )
    }

    return []
  }
)

export async function getPage(pageId: string): Promise<ExtendedRecordMap> {
  let recordMap = await notion.getPage(pageId)

  if (navigationStyle !== 'default') {
    // ensure that any pages linked to in the custom navigation header have
    // their block info fully resolved in the page record map so we know
    // the page title, slug, etc.
    const navigationLinkRecordMaps = await getNavigationLinkPages()

    if (navigationLinkRecordMaps?.length) {
      recordMap = navigationLinkRecordMaps.reduce(
        (map, navigationLinkRecordMap) =>
          mergeRecordMaps(map, navigationLinkRecordMap),
        recordMap
      )
    }
  }

  if (isPreviewImageSupportEnabled) {
    const previewImageMap = await getPreviewImageMap(recordMap)
    ;(recordMap as any).preview_images = previewImageMap
  }

  await getTweetsMap(recordMap)

  if (recordMap.block) {
    const rootBlockId = Object.keys(recordMap.block)[0]
    for (const id of Object.keys(recordMap.block)) {
      const block = getBlockValue(recordMap.block[id])
      if (
        block &&
        (block.type === 'page' || block.type === 'collection_view_page') &&
        id !== pageId &&
        id !== rootBlockId
      ) {
        const isPublic =
          getPageProperty<boolean | null>('Public', block, recordMap) ??
          getPageProperty<boolean | null>('public', block, recordMap) ??
          getPageProperty<boolean | null>('Public?', block, recordMap)
        const isPublished =
          getPageProperty<boolean | null>('Published', block, recordMap) ??
          getPageProperty<boolean | null>('published', block, recordMap)
        const isPublish = getPageProperty<boolean | null>('publish', block, recordMap)
        const status =
          getPageProperty<string | null>('Status', block, recordMap) ||
          getPageProperty<string | null>('status', block, recordMap)

        if (
          isPublic === false ||
          isPublished === false ||
          isPublish === false ||
          (status &&
            status !== 'Published' &&
            status !== 'Public' &&
            status !== 'Done' &&
            status !== 'Active')
        ) {
          delete recordMap.block[id]
        }
      }
    }
  }

  if (recordMap.collection_query) {
    for (const collectionId of Object.keys(recordMap.collection_query)) {
      const views = recordMap.collection_query[collectionId]
      if (!views) continue
      for (const viewId of Object.keys(views)) {
        const queryResult = views[viewId]
        if (queryResult?.collection_group_results) {
          const groupResults = queryResult.collection_group_results
          if (Array.isArray(groupResults)) {
            for (const group of groupResults) {
              if (group.blockIds) {
                group.blockIds = group.blockIds.filter(
                  (id) => recordMap.block[id]
                )
              }
            }
          }
        }
        if (queryResult?.blockIds) {
          queryResult.blockIds = queryResult.blockIds.filter(
            (id) => recordMap.block[id]
          )
        }
      }
    }
  }

  return recordMap
}

export async function search(params: SearchParams): Promise<SearchResults> {
  return notion.search(params)
}
