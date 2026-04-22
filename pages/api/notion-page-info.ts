import { type NextApiRequest, type NextApiResponse } from 'next'
import { parsePageId } from 'notion-utils'

import * as libConfig from '@/lib/config'
import { mapImageUrl } from '@/lib/map-image-url'
import { notion } from '@/lib/notion-api'
import { type NotionPageInfo } from '@/lib/types'

export default async function notionPageInfo(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const pageId = (req.query.pageId as string) || libConfig.rootNotionPageId
  const parsedPageId = parsePageId(pageId)

  if (!parsedPageId) {
    return res.status(400).json({ error: 'Invalid notion page id' })
  }

  try {
    const recordMap = await notion.getPage(parsedPageId)

    const keys = Object.keys(recordMap?.block || {})
    const block = getBlockValue(recordMap?.block?.[keys[0]!]) as any

    if (!block) {
      return res.status(404).json({ error: 'Page not found' })
    }

    const blockSpaceId = block.space_id

    if (
      blockSpaceId &&
      libConfig.rootNotionSpaceId &&
      blockSpaceId !== libConfig.rootNotionSpaceId
    ) {
      return res.status(400).json({
        error: `Notion page "${pageId}" belongs to a different workspace.`
      })
    }

    const isBlogPost =
      block.type === 'page' && block.parent_table === 'collection'
    const title = getBlockTitle(block, recordMap) || libConfig.name

    const imageCoverPosition =
      block.format?.page_cover_position ?? libConfig.defaultPageCoverPosition
    const imageObjectPosition = imageCoverPosition
      ? `center ${(1 - imageCoverPosition) * 100}%`
      : undefined

    const imageBlockUrl = mapImageUrl(
      getPageProperty('Social Image', block, recordMap) ||
        block.format?.page_cover,
      block
    )
    const imageFallbackUrl = mapImageUrl(libConfig.defaultPageCover, block)

    const blockIcon = getBlockIcon(block, recordMap)
    const authorImageBlockUrl = mapImageUrl(
      blockIcon && isUrl(blockIcon) ? blockIcon : undefined,
      block
    )
    const authorImageFallbackUrl = mapImageUrl(libConfig.defaultPageIcon, block)

    const author = getPageProperty('Author', block, recordMap) || libConfig.author

    const publishedTime = getPageProperty('Published', block, recordMap)
    const datePublished = publishedTime ? new Date(publishedTime) : undefined
    const date =
      isBlogPost && datePublished
        ? `${datePublished.toLocaleString('en-US', {
            month: 'long'
          })} ${datePublished.getFullYear()}`
        : undefined
    const detail = date || author || libConfig.domain

    const pageInfo: NotionPageInfo = {
      pageId: parsedPageId,
      title,
      image: imageBlockUrl || imageFallbackUrl || undefined,
      imageObjectPosition,
      author,
      authorImage: authorImageBlockUrl || authorImageFallbackUrl || undefined,
      detail
    }

    res.setHeader(
      'Cache-Control',
      'public, s-maxage=3600, max-age=3600, stale-while-revalidate=3600'
    )
    res.status(200).json(pageInfo)
  } catch (err: any) {
    console.error(err)
    res.status(500).json({ error: err.message || 'Internal server error' })
  }
}

function getBlockTitle(block: any, recordMap: any) {
  if (block.properties?.title) {
    return getTextContent(block.properties.title)
  }

  if (
    (block.type === 'collection_view_page' ||
      block.type === 'collection_view') &&
    recordMap.collection
  ) {
    const collectionId = block.collection_id
    const collection = recordMap.collection[collectionId]?.value
    if (collection?.name) {
      return getTextContent(collection.name)
    }
  }

  return ''
}

function getBlockIcon(block: any, recordMap: any) {
  if (block.format?.page_icon) {
    return block.format.page_icon
  }

  if (
    (block.type === 'collection_view_page' ||
      block.type === 'collection_view') &&
    recordMap.collection
  ) {
    const collectionId = block.collection_id
    const collection = recordMap.collection[collectionId]?.value
    if (collection?.icon) {
      return collection.icon
    }
  }

  return null
}

function getPageProperty(
  propertyName: string,
  block: any,
  recordMap: any
): any {
  try {
    const collectionId = block.collection_id
    const collection = recordMap.collection?.[collectionId]?.value
    if (!collection) {
      return null
    }

    const schema = collection.schema
    const propertyId = Object.keys(schema).find(
      (key) => schema[key].name.toLowerCase() === propertyName.toLowerCase()
    )

    if (!propertyId) {
      return null
    }

    const propertyValue = block.properties?.[propertyId]
    if (!propertyValue) {
      return null
    }

    const type = schema[propertyId].type
    if (type === 'date') {
      const date = propertyValue[0]?.[1]?.[0]?.[1]?.start_date
      return date ? new Date(date).getTime() : null
    }

    return getTextContent(propertyValue)
  } catch {
    return null
  }
}

function getTextContent(text: any): string {
  if (!text) {
    return ''
  }

  if (Array.isArray(text)) {
    return text
      .map((t) => (Array.isArray(t) ? t[0] : t))
      .filter((t) => typeof t === 'string')
      .join('')
  }

  return String(text)
}

function isUrl(url: string | undefined | null): boolean {
  if (!url) {
    return false
  }

  return /^(https?:\/\/|data:)/i.test(url)
}
