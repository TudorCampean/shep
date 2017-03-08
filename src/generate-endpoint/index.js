import generateFunction from '../generate-function'
import { writeJSON } from '../util/modules/fs'
import { cors } from './templates'
import genName from '../util/generate-name'
import listr from '../util/modules/listr'
import * as load from '../util/load'

const integration = 'x-amazon-apigateway-integration'

export default function (opts) {
  let accountId = opts.accountId
  let path = opts.path
  let method = opts.method
  let region = opts.region || 'us-east-1';

  if (!accountId) {
    throw new Error('Unable to determine your AWS Account ID. Please set it in the `shep` section of package.json')
  }

  const api = load.api() || {}

  const name = `${path} ${method}`
  const { shortName, fullName } = genName(name)

  const tasks = listr([
    {
      title: `Generate Function ${shortName}`,
      task: () => generateFunction({ name, quiet: true })
    },
    {
      title: 'Setup Endpoint',
      task: () => addPath(api, path, method, accountId, fullName, region)
    },
    {
      title: 'Setup CORS',
      task: () => setupCORS(api, path)
    },
    {
      title: 'Write api.json',
      task: () => writeJSON('api.json', api, { spaces: 2 })
    }
  ], opts.quiet)

  return tasks.run()
}

function addPath (api, path, method, accountId, functionName, region) {
  if (method === 'any') { method = 'x-amazon-apigateway-any-method' }

  if (!api.paths) {
    api.paths = {}
  }

  api.paths[path] = api.paths[path] || {}
  if (api.paths[path][method] !== undefined) { throw new Error(`Method '${method}' on path '${path}' already exists`) }
  api.paths[path][method] = api.paths[path][method] || {}
  api.paths[path][method][integration] = {
    uri: `arn:aws:apigateway:${region}:lambda:path/2015-03-31/functions/arn:aws:lambda:${region}:${accountId}:function:${functionName}:\${stageVariables.functionAlias}/invocations`,
    passthroughBehavior: 'when_no_match',
    httpMethod: 'POST',
    type: 'aws_proxy'
  }
}

function setupCORS (api, path) {
  api.paths[path].options = api.paths[path].options || cors
}
