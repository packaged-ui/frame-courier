export class Frame
{
  /**
   * @param obj
   * @returns {Frame}
   */
  static fromObject(obj)
  {
    return Object.setPrototypeOf(obj, this.prototype);
  }

  constructor(id, tags, frameNumber, origin)
  {
    if(tags && (typeof tags === 'string'))
    {
      tags = tags.split(/\s+/);
    }
    else if(!Array.isArray(tags))
    {
      console.warn('invalid tags for frame', {id, tags})
      tags = [];
    }

    this._id = id;
    this._tags = typeof tags === 'string' ? tags.split(/\s+/) : tags;
    this._frameNumber = frameNumber;
    this._origin = origin;
  }

  get id()
  {
    return this._id;
  }

  get tags()
  {
    return this._tags;
  }

  get frameNumber()
  {
    return this._frameNumber;
  }

  setFrameNumber(frameNumber)
  {
    this._frameNumber = frameNumber;
    return this;
  }

  setOrigin(origin)
  {
    this._origin = origin;
    return this;
  }

  get origin()
  {
    return this._origin;
  }
}