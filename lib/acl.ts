import { getBlockValue, getPageProperty } from 'notion-utils'

import type { PageProps } from './types'

export async function pageAcl({
  site,
  recordMap,
  pageId
}: PageProps): Promise<PageProps | undefined> {
  if (!site) {
    return {
      error: {
        statusCode: 404,
        message: 'Unable to resolve notion site'
      }
    }
  }

  if (!recordMap) {
    return {
      error: {
        statusCode: 404,
        message: `Unable to resolve page for domain "${site.domain}". Notion page "${pageId}" not found.`
      }
    }
  }

  const keys = Object.keys(recordMap.block)
  const rootKey = keys[0]

  if (!rootKey) {
    return {
      error: {
        statusCode: 404,
        message: `Unable to resolve page for domain "${site.domain}". Notion page "${pageId}" invalid data.`
      }
    }
  }

  const rootValue = getBlockValue(recordMap.block[rootKey])
  const isPublic =
    getPageProperty<boolean | null>('Public', rootValue!, recordMap) ??
    getPageProperty<boolean | null>('public', rootValue!, recordMap)
  const isPublished =
    getPageProperty<boolean | null>('Published', rootValue!, recordMap) ??
    getPageProperty<boolean | null>('published', rootValue!, recordMap)
  const isPublish = getPageProperty<boolean | null>('publish', rootValue!, recordMap)
  const status = getPageProperty<string | null>('Status', rootValue!, recordMap)

  if (
    isPublic === false ||
    isPublished === false ||
    isPublish === false ||
    (status && status !== 'Published' && status !== 'Public')
  ) {
    return {
      error: {
        statusCode: 404,
        message: `Notion page "${pageId}" is not public.`
      }
    }
  }

  const rootSpaceId = rootValue?.space_id

  if (
    rootSpaceId &&
    site.rootNotionSpaceId &&
    rootSpaceId !== site.rootNotionSpaceId
  ) {
    if (process.env.NODE_ENV) {
      return {
        error: {
          statusCode: 404,
          message: `Notion page "${pageId}" doesn't belong to the Notion workspace owned by "${site.domain}".`
        }
      }
    }
  }
}
